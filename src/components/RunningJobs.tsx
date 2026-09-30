import i18n from '@dhis2/d2-i18n'
import React, { useMemo } from 'react'
import styles from './RunningJobs.module.css'
import { JobCard } from '@/components/JobCard'
import type { EnhancedJob } from '@/types/jobs'

type RunningJobsProps = {
    jobs: EnhancedJob[]
    onViewDetails: (job: EnhancedJob) => void
}

type Grouped = {
    queues: Array<{ name: string; jobs: EnhancedJob[] }>
    independent: EnhancedJob[]
}

// HOUSEKEEPING runs constantly and is noise for an operator watching jobs.
const isMonitorable = (job: EnhancedJob) => job.jobType !== 'HOUSEKEEPING'

/**
 * Group running work exactly as the original tool did:
 *  - A queue is "active" if any of its (non-housekeeping) jobs is running.
 *    Active queues show ALL their jobs (so the operator sees what's next in
 *    line), ordered by queue position.
 *  - Jobs with no queue that are running show under "Now running".
 */
const groupRunningJobs = (jobs: EnhancedJob[]): Grouped => {
    const activeQueues = new Set(
        jobs
            .filter(
                (job) => job.isRunning && isMonitorable(job) && job.queueName
            )
            .map((job) => job.queueName as string)
    )

    const queueMap = new Map<string, EnhancedJob[]>()
    jobs.forEach((job) => {
        if (job.queueName && activeQueues.has(job.queueName)) {
            const existing = queueMap.get(job.queueName) ?? []
            existing.push(job)
            queueMap.set(job.queueName, existing)
        }
    })

    const queues = Array.from(queueMap.entries()).map(([name, queueJobs]) => ({
        name,
        jobs: [...queueJobs].sort(
            (a, b) => (a.queuePosition ?? 0) - (b.queuePosition ?? 0)
        ),
    }))

    const independent = jobs.filter(
        (job) => !job.queueName && job.isRunning && isMonitorable(job)
    )

    return { queues, independent }
}

export const RunningJobs: React.FC<RunningJobsProps> = ({
    jobs,
    onViewDetails,
}) => {
    const { queues, independent } = useMemo(
        () => groupRunningJobs(jobs),
        [jobs]
    )

    const hasActiveJobs = queues.length > 0 || independent.length > 0

    if (!hasActiveJobs) {
        return (
            <div className={styles.empty} data-test="no-running-jobs">
                {i18n.t('No running jobs')}
            </div>
        )
    }

    return (
        <div className={styles.container}>
            {queues.map((queue) => (
                <div
                    key={queue.name}
                    className={styles.queue}
                    data-test="job-queue"
                >
                    <h4 className={styles.queueTitle}>{queue.name}</h4>
                    <div className={styles.cards}>
                        {queue.jobs.map((job, index) => (
                            <JobCard
                                key={job.id}
                                job={job}
                                queuePosition={{
                                    index: index + 1,
                                    total: queue.jobs.length,
                                }}
                                onViewDetails={onViewDetails}
                            />
                        ))}
                    </div>
                </div>
            ))}

            {independent.length > 0 && (
                <div className={styles.queue}>
                    <h4 className={styles.queueTitle}>
                        {i18n.t('Now running')}
                    </h4>
                    <div className={styles.cards}>
                        {independent.map((job) => (
                            <JobCard
                                key={job.id}
                                job={job}
                                onViewDetails={onViewDetails}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
