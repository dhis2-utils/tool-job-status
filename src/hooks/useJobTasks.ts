import { JOB_POLL_INTERVAL } from '@/hooks/useJobs'
import type { Task } from '@/types/jobs'
import { useApiDataQuery } from '@/utils/useApiDataQuery'

type UseJobTasksOptions = {
    /** Only fetch when true (e.g. modal open, or card is for a running job). */
    enabled?: boolean
    /** Keep polling on an interval (running jobs); false = fetch once. */
    poll?: boolean
}

/**
 * Fetch the task history for a single job from the authoritative per-job
 * endpoint `system/tasks/{jobType}/{jobId}`. Used for live card progress and
 * the details modal. Polling is scoped to when the data is actually on screen
 * so we don't fan out requests for idle jobs.
 */
export const useJobTasks = (
    jobType: string | undefined,
    jobId: string | undefined,
    { enabled = true, poll = true }: UseJobTasksOptions = {}
) => {
    const canQuery = Boolean(jobType) && Boolean(jobId)

    const { data, isLoading, error, isFetching } = useApiDataQuery<Task[]>({
        queryKey: ['systemTasks', jobType, jobId],
        query: {
            resource: `system/tasks/${jobType}/${jobId}`,
        },
        enabled: enabled && canQuery,
        refetchInterval: poll ? JOB_POLL_INTERVAL : false,
    })

    return {
        tasks: data,
        isLoading,
        isFetching,
        error,
    }
}
