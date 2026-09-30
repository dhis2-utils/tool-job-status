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

/**
 * Derive a running job's progress from its task history (newest task first).
 *
 * Faithful to the original behaviour:
 *  - LOOP tasks carry a `[current/total]` counter -> percentage; the action
 *    text is the most recent non-LOOP message (falling back to "Processing").
 *  - Otherwise, show the latest INFO message.
 *  - If there is nothing useful to show, fall back to "Running".
 */
export const deriveJobProgress = (tasks: Task[] | undefined): JobProgress => {
    const latest = tasks?.[0]
    if (!latest) {
        return { percentage: null, text: 'Running' }
    }

    if (latest.level === 'LOOP' && latest.message) {
        const match = latest.message.match(/\[(\d+)\/(\d+)\]/)
        if (match) {
            const current = parseInt(match[1], 10)
            const total = parseInt(match[2], 10)
            const percentage =
                total > 0 ? Math.round((current / total) * 100) : null
            const actionTask = tasks?.find(
                (task) => task.level !== 'LOOP' && Boolean(task.message?.trim())
            )
            const action = actionTask?.message?.trim() || 'Processing'
            return { percentage, text: action }
        }
    }

    if (latest.level === 'INFO' && latest.message?.trim()) {
        return { percentage: null, text: latest.message.trim() }
    }

    return { percentage: null, text: 'Running' }
}

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
    { label: 'Status', value: summary.status ?? 'N/A' },
    { label: 'Predictors', value: summary.predictors ?? 'N/A' },
    { label: 'Inserted values', value: summary.inserted ?? 'N/A' },
    { label: 'Updated values', value: summary.updated ?? 'N/A' },
    { label: 'Deleted values', value: summary.deleted ?? 'N/A' },
    { label: 'Unchanged values', value: summary.unchanged ?? 'N/A' },
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

/**
 * Human-readable time until the next run. Improvement over the original, which
 * printed negative values for overdue jobs: clamps to a friendly "Due" / days.
 */
export const formatTimeUntil = (
    nextExecutionTime: string | undefined,
    now: Date
): string => {
    if (!nextExecutionTime) {
        return 'N/A'
    }
    const next = new Date(nextExecutionTime)
    if (Number.isNaN(next.getTime())) {
        return 'N/A'
    }

    const diffMinutes = Math.floor((next.getTime() - now.getTime()) / 60000)
    if (diffMinutes <= 0) {
        return 'Due now'
    }

    const days = Math.floor(diffMinutes / (60 * 24))
    const hours = Math.floor((diffMinutes % (60 * 24)) / 60)
    const minutes = diffMinutes % 60

    if (days > 0) {
        return `${days}d ${hours}h`
    }
    return `${hours}h ${minutes}m`
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
        return 'N/A'
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
        return 'N/A'
    }
    return duration.split('.')[0]
}
