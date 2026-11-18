import i18n from '@dhis2/d2-i18n'
import type { JobParameters, Task } from '@/types/jobs'

/*
 * Pure, side-effect-free parsing helpers extracted from the original vanilla-JS
 * app. Kept separate from React so they can be unit-tested in isolation — this
 * is the regression-prone logic (progress counters, message parsing).
 */

export interface JobProgress {
    /** Percentage 0-100 for LOOP tasks, otherwise null. */
    percentage: number | null
    /** Human-readable status/action text (never empty). */
    text: string
}

const LOOP_COUNTER_REGEX = /\[(\d+)\/(\d+)\]/

/**
 * Derive a running job's progress from its task history (newest task first).
 *
 * Mirrors the original tool, which only updated the progress line on a LOOP
 * task with a `[current/total]` counter or on a non-empty INFO message and
 * otherwise left the previous line on screen. Being stateless, we get the same
 * effect by scanning back past DEBUG/WARN/ERROR (and counter-less LOOP) lines
 * to the most recent useful entry:
 *  - LOOP with counter -> percentage; the action text is the most recent
 *    INFO message (falling back to "Processing").
 *  - INFO -> its message.
 *  - Nothing useful -> "Running".
 */
export const deriveJobProgress = (tasks: Task[] | undefined): JobProgress => {
    const latest = tasks?.find(
        (t) =>
            (t.level === 'LOOP' && LOOP_COUNTER_REGEX.test(t.message ?? '')) ||
            (t.level === 'INFO' && Boolean(t.message?.trim()))
    )
    const latestMessage = latest?.message?.trim()
    if (!latest || !latestMessage) {
        return { percentage: null, text: i18n.t('Running') }
    }

    const match =
        latest.level === 'LOOP' ? latestMessage.match(LOOP_COUNTER_REGEX) : null
    if (match) {
        const current = Number.parseInt(match[1], 10)
        const total = Number.parseInt(match[2], 10)
        const percentage =
            total > 0 ? Math.round((current / total) * 100) : null
        const actionTask = tasks?.find(
            (task) => task.level === 'INFO' && Boolean(task.message?.trim())
        )
        const action = actionTask?.message?.trim() || i18n.t('Processing')
        return { percentage, text: action }
    }

    return { percentage: null, text: latestMessage }
}

/** Shown for a value the API did not send. */
const notAvailable = (): string => i18n.t('N/A')

export interface PredictionSummary {
    status?: string
    predictors?: string
    inserted?: string
    updated?: string
    deleted?: string
    unchanged?: string
    [key: string]: string | undefined
}

/**
 * Parse the `PredictionSummary{status='SUCCESS', predictors=3, ...}` blob that
 * PREDICTOR jobs write into a task message. Returns null if the message is not
 * a prediction summary.
 */
export const parsePredictionSummary = (
    message: string | undefined
): PredictionSummary | null => {
    if (!message) {
        return null
    }
    const match = message.match(/PredictionSummary\{(.+)\}/)
    if (!match) {
        return null
    }

    const summary: PredictionSummary = {}
    match[1]
        .split(',')
        .map((pair) => pair.trim())
        .forEach((pair) => {
            const eq = pair.indexOf('=')
            if (eq === -1) {
                return
            }
            const key = pair.slice(0, eq).trim()
            const value = pair
                .slice(eq + 1)
                .trim()
                .replace(/'/g, '')
            if (key) {
                summary[key] = value
            }
        })

    return summary
}

/** Find the most recent task carrying a parseable prediction summary. */
export const findPredictionSummary = (
    tasks: Task[] | undefined
): PredictionSummary | null => {
    const task = tasks?.find((t) => t.message?.includes('PredictionSummary'))
    return task ? parsePredictionSummary(task.message) : null
}

/** Ordered rows for rendering a prediction summary as a table. */
export const predictionSummaryRows = (
    summary: PredictionSummary
): Array<{ label: string; value: string }> => [
    { label: i18n.t('Status'), value: summary.status ?? notAvailable() },
    {
        label: i18n.t('Predictors'),
        value: summary.predictors ?? notAvailable(),
    },
    {
        label: i18n.t('Inserted values'),
        value: summary.inserted ?? notAvailable(),
    },
    {
        label: i18n.t('Updated values'),
        value: summary.updated ?? notAvailable(),
    },
    {
        label: i18n.t('Deleted values'),
        value: summary.deleted ?? notAvailable(),
    },
    {
        label: i18n.t('Unchanged values'),
        value: summary.unchanged ?? notAvailable(),
    },
]

/**
 * Skippable analytics table types — the `AnalyticsTableType` enum, identical
 * across DHIS2 v41-v43. Matched against `skipTableTypes`.
 */
const ANALYTICS_TABLE_TYPES = [
    'DATA_VALUE',
    'COMPLETENESS',
    'COMPLETENESS_TARGET',
    'ORG_UNIT_TARGET',
    'VALIDATION_RESULT',
    'EVENT',
    'ENROLLMENT',
    'OWNERSHIP',
    'TRACKED_ENTITY_INSTANCE_EVENTS',
    'TRACKED_ENTITY_INSTANCE_ENROLLMENTS',
    'TRACKED_ENTITY_INSTANCE',
] as const

/**
 * Extra rows shown in the parameter table that are NOT `skipTableTypes` values
 * but have their own boolean skip flags (skipResourceTables / skipOutliers).
 */
const ANALYTICS_SPECIAL_ROWS = [
    'RESOURCE_TABLES',
    'OUTLIER_STATISTICS',
] as const

/** All rows shown in the ANALYTICS_TABLE parameter table. */
export const ANALYTICS_TABLE_ELEMENTS = [
    ...ANALYTICS_TABLE_TYPES,
    ...ANALYTICS_SPECIAL_ROWS,
] as const

const toArray = (value: string[] | string | undefined): string[] => {
    if (Array.isArray(value)) {
        return value
    }
    if (typeof value === 'string') {
        return value.split(',').map((entry) => entry.trim())
    }
    return []
}

/** Whether an analytics table element is included given the job parameters. */
export const isAnalyticsTableIncluded = (
    element: string,
    params: JobParameters = {}
): boolean => {
    if (element === 'RESOURCE_TABLES') {
        return params.skipResourceTables !== true
    }
    if (element === 'OUTLIER_STATISTICS') {
        return params.skipOutliers !== true
    }
    return !toArray(params.skipTableTypes).includes(element)
}

export interface AnalyticsParamRow {
    element: string
    included: boolean
}

export const analyticsParamRows = (
    params: JobParameters = {}
): AnalyticsParamRow[] =>
    ANALYTICS_TABLE_ELEMENTS.map((element) => ({
        element,
        included: isAnalyticsTableIncluded(element, params),
    }))

export const analyticsSkippedPrograms = (
    params: JobParameters = {}
): string[] => toArray(params.skipPrograms)

const HAS_OFFSET_REGEX = /(?:[zZ]|[+-]\d{2}:?\d{2})$/

/** Offset of `timeZone` from UTC at `epochMs`, in milliseconds. */
const zoneOffsetMs = (timeZone: string, epochMs: number): number => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).formatToParts(new Date(epochMs))
    const part = (type: Intl.DateTimeFormatPartTypes) =>
        Number(parts.find((p) => p.type === type)?.value)
    const wallClockAsUtc = Date.UTC(
        part('year'),
        part('month') - 1,
        part('day'),
        part('hour'),
        part('minute'),
        part('second')
    )
    return wallClockAsUtc - Math.floor(epochMs / 1000) * 1000
}

/**
 * Parse a DHIS2 datetime to epoch milliseconds. DHIS2 sends job times as the
 * server's wall-clock time with no offset ("2026-07-14T12:30:00.000"), so
 * they are read in the server's time zone (`serverTimeZoneId` from
 * system/info), not the browser's. A value with an explicit offset keeps it.
 * Without a usable time zone, falls back to the browser's. NaN if invalid.
 */
export const parseServerDateTime = (
    value: string,
    timeZone?: string
): number => {
    const browserParsed = new Date(value).getTime()
    if (!timeZone || HAS_OFFSET_REGEX.test(value)) {
        return browserParsed
    }
    const wallClockAsUtc = Date.parse(`${value}Z`)
    if (Number.isNaN(wallClockAsUtc)) {
        return browserParsed
    }
    try {
        // Two passes, so a time just after a DST change gets the new offset.
        const guess = wallClockAsUtc - zoneOffsetMs(timeZone, wallClockAsUtc)
        return wallClockAsUtc - zoneOffsetMs(timeZone, guess)
    } catch {
        // An unknown time zone id: Intl throws a RangeError.
        return browserParsed
    }
}

/**
 * Human-readable time until the next run. Improvement over the original, which
 * printed negative values for overdue jobs: clamps to a friendly "Due" / days.
 * `serverTimeZone` is the zone `nextExecutionTime` is expressed in.
 */
export const formatTimeUntil = (
    nextExecutionTime: string | undefined,
    now: Date,
    serverTimeZone?: string
): string => {
    if (!nextExecutionTime) {
        return notAvailable()
    }
    const next = parseServerDateTime(nextExecutionTime, serverTimeZone)
    if (Number.isNaN(next)) {
        return notAvailable()
    }

    const diffMinutes = Math.floor((next - now.getTime()) / 60000)
    if (diffMinutes <= 0) {
        return i18n.t('Due now')
    }

    const days = Math.floor(diffMinutes / (60 * 24))
    const hours = Math.floor((diffMinutes % (60 * 24)) / 60)
    const minutes = diffMinutes % 60

    // No colon in these keys: the i18n extractor reads ':' as a namespace.
    if (days > 0) {
        return i18n.t('{{days}}d {{hours}}h', { days, hours })
    }
    return i18n.t('{{hours}}h {{minutes}}m', { hours, minutes })
}

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * Format a DHIS2 datetime for display as "YYYY-MM-DD HH:mm:ss" (drops the ISO
 * `T` separator and milliseconds). DHIS2 datetimes carry no timezone, so we
 * reformat the wall-clock time as-is. Unrecognised strings are returned
 * unchanged; empty input yields "N/A".
 */
export const formatDateTime = (iso: string | undefined): string => {
    if (!iso) {
        return notAvailable()
    }
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) {
        return iso
    }
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    )
}

/**
 * Trim the milliseconds off a DHIS2 runtime/duration string
 * (e.g. "00:08:33.965" -> "00:08:33"). Empty input yields "N/A".
 */
export const formatDuration = (duration: string | undefined): string => {
    if (!duration) {
        return notAvailable()
    }
    return duration.split('.')[0]
}
