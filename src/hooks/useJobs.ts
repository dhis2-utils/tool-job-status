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
        const tasks = tasksQuery.data
        return configs.map((job) => ({
            ...job,
            isRunning:
                job.jobStatus === 'RUNNING' ||
                isTaskRunning(tasks?.[job.jobType]?.[job.id]),
        }))
    }, [configQuery.data, tasksQuery.data])

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
