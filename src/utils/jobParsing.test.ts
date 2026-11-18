import type { Task } from '@/types/jobs'
import {
    analyticsParamRows,
    analyticsSkippedPrograms,
    deriveJobProgress,
    findPredictionSummary,
    formatDateTime,
    formatDuration,
    formatTimeUntil,
    isAnalyticsTableIncluded,
    parseServerDateTime,
    parsePredictionSummary,
    predictionSummaryRows,
} from '@/utils/jobParsing'

const task = (partial: Partial<Task>): Task => ({
    level: 'INFO',
    time: '2026-07-14T10:00:00.000',
    ...partial,
})

describe('deriveJobProgress', () => {
    it('returns "Running" when there are no tasks', () => {
        expect(deriveJobProgress(undefined)).toEqual({
            percentage: null,
            text: 'Running',
        })
        expect(deriveJobProgress([])).toEqual({
            percentage: null,
            text: 'Running',
        })
    })

    it('extracts percentage and action from a LOOP task with a counter', () => {
        const tasks = [
            task({ level: 'LOOP', message: 'Processing rows [25/100]' }),
            task({ level: 'INFO', message: 'Generating analytics tables' }),
        ]
        expect(deriveJobProgress(tasks)).toEqual({
            percentage: 25,
            text: 'Generating analytics tables',
        })
    })

    it('rounds the percentage to the nearest integer', () => {
        const tasks = [task({ level: 'LOOP', message: '[1/3]' })]
        expect(deriveJobProgress(tasks).percentage).toBe(33)
    })

    it('falls back to "Processing" when a LOOP task has no preceding action', () => {
        const tasks = [task({ level: 'LOOP', message: '[10/50]' })]
        expect(deriveJobProgress(tasks)).toEqual({
            percentage: 20,
            text: 'Processing',
        })
    })

    it('guards against a zero total', () => {
        const tasks = [task({ level: 'LOOP', message: '[0/0]' })]
        expect(deriveJobProgress(tasks).percentage).toBeNull()
    })

    it('shows the latest INFO message when not looping', () => {
        const tasks = [
            task({ level: 'INFO', message: 'Analytics tables updated' }),
        ]
        expect(deriveJobProgress(tasks)).toEqual({
            percentage: null,
            text: 'Analytics tables updated',
        })
    })

    it('falls back to "Running" for a level with no useful message', () => {
        const tasks = [task({ level: 'DEBUG', message: '' })]
        expect(deriveJobProgress(tasks)).toEqual({
            percentage: null,
            text: 'Running',
        })
    })

    it('keeps the last LOOP progress when a WARN/ERROR line is interleaved', () => {
        const tasks = [
            task({ level: 'WARN', message: 'Skipped a work item' }),
            task({ level: 'LOOP', message: 'Populating tables [3/10]' }),
            task({ level: 'INFO', message: 'Populating analytics tables' }),
        ]
        expect(deriveJobProgress(tasks)).toEqual({
            percentage: 30,
            text: 'Populating analytics tables',
        })
    })

    it('keeps the last INFO message when a DEBUG line is newest', () => {
        const tasks = [
            task({ level: 'DEBUG', message: 'internal detail' }),
            task({ level: 'INFO', message: 'Generating resource tables' }),
        ]
        expect(deriveJobProgress(tasks)).toEqual({
            percentage: null,
            text: 'Generating resource tables',
        })
    })

    it('skips a LOOP line without a counter and uses the earlier one', () => {
        const tasks = [
            task({ level: 'LOOP', message: 'no counter here' }),
            task({ level: 'LOOP', message: '[4/8]' }),
        ]
        expect(deriveJobProgress(tasks)).toEqual({
            percentage: 50,
            text: 'Processing',
        })
    })
})

describe('parsePredictionSummary', () => {
    it('parses a PredictionSummary blob into an object', () => {
        const message =
            "PredictionSummary{status='SUCCESS', predictors=3, inserted=10, updated=5, deleted=0, unchanged=2}"
        expect(parsePredictionSummary(message)).toEqual({
            status: 'SUCCESS',
            predictors: '3',
            inserted: '10',
            updated: '5',
            deleted: '0',
            unchanged: '2',
        })
    })

    it('returns null for a non-summary message', () => {
        expect(parsePredictionSummary('Just a log line')).toBeNull()
        expect(parsePredictionSummary(undefined)).toBeNull()
    })

    it('finds the summary task among many and builds ordered rows', () => {
        const tasks = [
            task({ message: 'done' }),
            task({
                message:
                    "Prediction done PredictionSummary{status='SUCCESS', predictors=1}",
            }),
        ]
        const summary = findPredictionSummary(tasks)
        expect(summary?.status).toBe('SUCCESS')
        const rows = summary ? predictionSummaryRows(summary) : []
        expect(rows[0]).toEqual({ label: 'Status', value: 'SUCCESS' })
        // Missing fields render as N/A
        expect(rows[2]).toEqual({ label: 'Inserted values', value: 'N/A' })
    })
})

describe('analytics parameters', () => {
    it('marks a table type as excluded when it is in skipTableTypes', () => {
        expect(
            isAnalyticsTableIncluded('EVENT', { skipTableTypes: ['EVENT'] })
        ).toBe(false)
        expect(
            isAnalyticsTableIncluded('DATA_VALUE', {
                skipTableTypes: ['EVENT'],
            })
        ).toBe(true)
    })

    it('accepts a comma-separated string for skipTableTypes', () => {
        expect(
            isAnalyticsTableIncluded('EVENT', {
                skipTableTypes: 'EVENT,ENROLLMENT',
            })
        ).toBe(false)
    })

    it('handles the special RESOURCE_TABLES / OUTLIER_STATISTICS booleans', () => {
        expect(
            isAnalyticsTableIncluded('RESOURCE_TABLES', {
                skipResourceTables: true,
            })
        ).toBe(false)
        expect(
            isAnalyticsTableIncluded('OUTLIER_STATISTICS', {
                skipOutliers: true,
            })
        ).toBe(false)
        expect(isAnalyticsTableIncluded('RESOURCE_TABLES', {})).toBe(true)
    })

    it('produces a row per known element and lists skipped programs', () => {
        const rows = analyticsParamRows({ skipTableTypes: ['EVENT'] })
        // 11 AnalyticsTableType values + 2 special boolean rows
        expect(rows).toHaveLength(13)
        expect(rows.find((r) => r.element === 'EVENT')?.included).toBe(false)
        // enum values missing from the original list are now present
        expect(rows.find((r) => r.element === 'ORG_UNIT_TARGET')).toBeDefined()
        expect(
            rows.find((r) => r.element === 'VALIDATION_RESULT')
        ).toBeDefined()
        expect(
            analyticsSkippedPrograms({ skipPrograms: ['abc', 'def'] })
        ).toEqual(['abc', 'def'])
    })
})

describe('formatDateTime', () => {
    it('reformats an ISO datetime, dropping the T and milliseconds', () => {
        expect(formatDateTime('2026-07-14T11:20:40.057')).toBe(
            '2026-07-14 11:20:40'
        )
    })

    it('returns N/A for empty input and passes through unparseable strings', () => {
        expect(formatDateTime(undefined)).toBe('N/A')
        expect(formatDateTime('not-a-date')).toBe('not-a-date')
    })
})

describe('formatDuration', () => {
    it('trims milliseconds from a runtime string', () => {
        expect(formatDuration('00:08:33.965')).toBe('00:08:33')
        expect(formatDuration('00:00:00')).toBe('00:00:00')
    })

    it('returns N/A for empty input', () => {
        expect(formatDuration(undefined)).toBe('N/A')
    })
})

describe('formatTimeUntil', () => {
    const now = new Date('2026-07-14T10:00:00.000Z')

    it('returns N/A for missing or invalid input', () => {
        expect(formatTimeUntil(undefined, now)).toBe('N/A')
        expect(formatTimeUntil('not-a-date', now)).toBe('N/A')
    })

    it('formats hours and minutes', () => {
        expect(formatTimeUntil('2026-07-14T12:30:00.000Z', now)).toBe('2h 30m')
    })

    it('formats days and hours for far-off runs', () => {
        expect(formatTimeUntil('2026-07-16T13:00:00.000Z', now)).toBe('2d 3h')
    })

    it('shows "Due now" for past or imminent runs (improvement over raw negatives)', () => {
        expect(formatTimeUntil('2026-07-14T09:00:00.000Z', now)).toBe('Due now')
    })
})

// DHIS2 sends job times as server wall-clock time with no offset
// ("2026-07-14T12:30:00.000"); they must be read in the server's time zone,
// not in the browser's.
describe('parseServerDateTime', () => {
    it('reads a time without offset in the server time zone', () => {
        expect(
            parseServerDateTime('2026-07-14T21:30:00.000', 'Asia/Tokyo')
        ).toBe(Date.parse('2026-07-14T12:30:00.000Z'))
        expect(
            parseServerDateTime('2026-07-14T08:30:00.000', 'America/New_York')
        ).toBe(Date.parse('2026-07-14T12:30:00.000Z'))
        expect(parseServerDateTime('2026-07-14T12:30:00.000', 'Etc/UTC')).toBe(
            Date.parse('2026-07-14T12:30:00.000Z')
        )
    })

    it('follows daylight saving time in the server time zone', () => {
        // Oslo is UTC+1 in January and UTC+2 in July.
        expect(
            parseServerDateTime('2026-01-14T13:30:00.000', 'Europe/Oslo')
        ).toBe(Date.parse('2026-01-14T12:30:00.000Z'))
        expect(
            parseServerDateTime('2026-07-14T14:30:00.000', 'Europe/Oslo')
        ).toBe(Date.parse('2026-07-14T12:30:00.000Z'))
    })

    it('keeps an explicit offset', () => {
        expect(
            parseServerDateTime('2026-07-14T12:30:00.000Z', 'Asia/Tokyo')
        ).toBe(Date.parse('2026-07-14T12:30:00.000Z'))
        expect(
            parseServerDateTime('2026-07-14T14:30:00.000+02:00', 'Asia/Tokyo')
        ).toBe(Date.parse('2026-07-14T12:30:00.000Z'))
    })

    it('falls back to the browser time zone without a usable server zone', () => {
        const local = new Date('2026-07-14T12:30:00.000').getTime()
        expect(parseServerDateTime('2026-07-14T12:30:00.000')).toBe(local)
        expect(
            parseServerDateTime('2026-07-14T12:30:00.000', 'Not/AZone')
        ).toBe(local)
    })

    it('returns NaN for input that is not a date', () => {
        expect(parseServerDateTime('not-a-date', 'Etc/UTC')).toBeNaN()
    })
})

describe('formatTimeUntil with a server time zone', () => {
    const now = new Date('2026-07-14T10:00:00.000Z')

    it('counts down to a server wall-clock time, whatever the browser zone', () => {
        // 21:30 in Tokyo is 12:30 UTC: 2h 30m after `now`.
        expect(
            formatTimeUntil('2026-07-14T21:30:00.000', now, 'Asia/Tokyo')
        ).toBe('2h 30m')
        expect(
            formatTimeUntil('2026-07-14T08:30:00.000', now, 'America/New_York')
        ).toBe('2h 30m')
    })
})
