import i18n from '@dhis2/d2-i18n'
import React, { useMemo } from 'react'
import styles from './RunningJobs.module.css'
import { JobCard } from '@/components/JobCard'
import type { EnhancedJob } from '@/types/jobs'

interface RunningJobsProps {
    jobs: EnhancedJob[]
    onViewDetails: (job: EnhancedJob) => void
}

interface Grouped {
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
 *  - Running jobs with no queue are listed after the queues.
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

    const queues = [...queueMap.entries()].map(([name, queueJobs]) => ({
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

    const independentCards = (
        <div className={styles.cards}>
            {independent.map((job) => (
                <JobCard key={job.id} job={job} onViewDetails={onViewDetails} />
            ))}
        </div>
    )

    return (
        <div className={styles.container}>
            {/* One heading for everything that runs: queues and jobs outside a
                queue are groups under it, not separate sections. */}
            <h3 className={styles.heading}>{i18n.t('Now running')}</h3>

            {!hasActiveJobs && (
                <div className={styles.empty} data-test="no-running-jobs">
                    {i18n.t('No running jobs')}
                </div>
            )}

            {queues.map((queue) => (
                <div
                    key={queue.name}
                    className={styles.group}
                    data-test="job-queue"
                >
                    <h4 className={styles.groupTitle}>
                        <span className={styles.groupLabel}>
                            {i18n.t('Queue')}
                        </span>{' '}
                        {queue.name}
                    </h4>
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

            {/* Label jobs outside a queue only when there are queues to tell
                them apart from. */}
            {independent.length > 0 && queues.length > 0 && (
                <div className={styles.group}>
                    <h4 className={styles.groupTitle}>
                        {i18n.t('Not in a queue')}
                    </h4>
                    {independentCards}
                </div>
            )}
            {independent.length > 0 && queues.length === 0 && independentCards}
        </div>
    )
}
