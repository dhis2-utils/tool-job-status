/*
 * Domain types for the DHIS2 job-monitoring endpoints.
 *
 * These are intentionally hand-written (rather than imported wholesale from
 * @dhis2/api-types) because the app only touches a small, stable subset of the
 * scheduler API, and that subset must behave identically across DHIS2 v41-v43.
 * Fields the API may omit are marked optional so the UI degrades gracefully on
 * any version.
 */

// Enum values confirmed identical across DHIS2 v41-v43 (api-types spec).
export type JobStatus =
    | 'RUNNING'
    | 'SCHEDULED'
    | 'DISABLED'
    | 'COMPLETED'
    | 'STOPPED'
    | 'FAILED'
    | 'NOT_STARTED'
    | string

/**
 * The task/notification "level". LOOP marks iterative progress (its message
 * carries a `[current/total]` counter); the others are plain log lines.
 */
export type TaskLevel =
    | 'OFF'
    | 'DEBUG'
    | 'LOOP'
    | 'INFO'
    | 'WARN'
    | 'ERROR'
    | string

/** A single scheduler task notification (from /api/system/tasks...). */
export interface Task {
    uid?: string
    id?: string
    level: TaskLevel
    category?: string
    time: string
    message?: string
    completed?: boolean
}

/**
 * Global task map returned by GET /api/system/tasks:
 * { [jobType]: { [jobId]: Task[] } }. Newest task is first in each array.
 */
export type SystemTasks = Record<string, Record<string, Task[]>>

/** Parameters vary by jobType; we only read a few, so keep it permissive. */
export interface JobParameters {
    // ANALYTICS_TABLE
    years?: number | string
    skipTableTypes?: string[] | string
    skipPrograms?: string[] | string
    skipResourceTables?: boolean
    skipOutliers?: boolean
    lastYears?: number
    // allow any other job-type-specific parameters
    [key: string]: unknown
}

export interface JobConfiguration {
    id: string
    name?: string
    displayName: string
    jobType: string
    jobStatus?: JobStatus
    enabled?: boolean
    jobParameters?: JobParameters
    lastExecuted?: string
    lastExecutedStatus?: string
    lastFinished?: string
    lastRuntimeExecution?: string
    nextExecutionTime?: string
    queueName?: string
    queuePosition?: number
    cronExpression?: string
    delay?: number
}

export interface JobConfigurationsResponse {
    jobConfigurations: JobConfiguration[]
}

/** A JobConfiguration enriched with derived running state. */
export interface EnhancedJob extends JobConfiguration {
    isRunning: boolean
}
