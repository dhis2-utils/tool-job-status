import { useMemo } from 'react'
import type {
    EnhancedJob,
    JobConfigurationsResponse,
    SystemTasks,
    Task,
} from '@/types/jobs'
import { useApiDataQuery } from '@/utils/useApiDataQuery'

/** Fields the UI reads. `fields` and `paging` are stable across v41-v43. */
const JOB_FIELDS = [
    'id',
    'jobType',
    'jobStatus',
    'displayName',
    'jobParameters',
    'lastExecuted',
    'lastExecutedStatus',
    'lastFinished',
    'lastRuntimeExecution',
    'nextExecutionTime',
    'queueName',
    'queuePosition',
    'executedBy',
].join(',')

/** Poll cadence for job + task data. */
export const JOB_POLL_INTERVAL = 3000

/**
 * A job is "running" if the latest task for it is neither completed nor an
 * error. Mirrors the original tool's `isJobRunning`.
 */
const isTaskRunning = (tasks: Task[] | undefined): boolean => {
    const lastTask = tasks?.[0]
    if (!lastTask) {
        return false
    }
    return !lastTask.completed && lastTask.level !== 'ERROR'
}

/**
 * Whether the server holds any task message for a job. DHIS2 writes messages
 * only for some job types (JobType.isUsingNotifications in dhis2-core; the
 * others record errors only), keeps them in memory unless Redis is set up, so
 * a restart loses them, and drops them after notifierMaxAgeDays (7) or beyond
 * notifierMaxJobsPerType (500). The global map is a gist (newest and oldest
 * message per job), which is enough to tell whether there are any.
 */
const hasTaskMessages = (tasks: Task[] | undefined): boolean =>
    tasks?.some((task) => Boolean(task.message?.trim())) ?? false

/**
 * Poll job configurations and the global task map together, and derive a
 * per-job `isRunning` flag. The global `system/tasks` map is used ONLY for the
 * cheap running-state check; live per-job progress comes from `useJobTasks`
 * (the more authoritative per-job endpoint).
 */
export const useJobs = () => {
    const configQuery = useApiDataQuery<JobConfigurationsResponse>({
        queryKey: ['jobConfigurations'],
        query: {
            resource: 'jobConfigurations',
            params: {
                paging: false,
                fields: JOB_FIELDS,
            },
        },
        refetchInterval: JOB_POLL_INTERVAL,
    })

    const tasksQuery = useApiDataQuery<SystemTasks>({
        queryKey: ['systemTasks'],
        query: {
            resource: 'system/tasks',
        },
        refetchInterval: JOB_POLL_INTERVAL,
    })

    const jobs = useMemo<EnhancedJob[]>(() => {
        const configs = configQuery.data?.jobConfigurations ?? []
        // react-query keeps the last good data when a refetch fails. If the
        // task poll is failing while configs keep refreshing, that frozen map
        // would keep a finished job "running", so fall back to jobStatus only.
        const tasks = tasksQuery.isError ? undefined : tasksQuery.data
        return configs.map((job) => {
            const jobTasks = tasks?.[job.jobType]?.[job.id]
            return {
                ...job,
                isRunning:
                    job.jobStatus === 'RUNNING' || isTaskRunning(jobTasks),
                hasDetails: tasks ? hasTaskMessages(jobTasks) : undefined,
            }
        })
    }, [configQuery.data, tasksQuery.data, tasksQuery.isError])

    return {
        jobs,
        // The two queries share a cadence; treat them as one dataset for the UI.
        isLoading: configQuery.isLoading || tasksQuery.isLoading,
        isFetching: configQuery.isFetching || tasksQuery.isFetching,
        error: configQuery.error || tasksQuery.error,
        dataUpdatedAt: Math.max(
            configQuery.dataUpdatedAt,
            tasksQuery.dataUpdatedAt
        ),
        refetch: () => {
            configQuery.refetch()
            tasksQuery.refetch()
        },
    }
}
