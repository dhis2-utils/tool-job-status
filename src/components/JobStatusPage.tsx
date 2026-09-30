import i18n from '@dhis2/d2-i18n'
import { Button, CircularLoader, NoticeBox } from '@dhis2/ui'
import React, { useCallback, useMemo, useState } from 'react'
import styles from './JobStatusPage.module.css'
import { JobDetailsModal } from '@/components/JobDetailsModal'
import { JobList } from '@/components/JobList'
import { RunningJobs } from '@/components/RunningJobs'
import { UpdatedAgo } from '@/components/UpdatedAgo'
import { useJobs } from '@/hooks/useJobs'
import type { EnhancedJob } from '@/types/jobs'

const MAX_LAST_JOBS = 6
const MAX_UPCOMING_JOBS = 10

const byDateDesc = (a?: string, b?: string) =>
    new Date(b ?? 0).getTime() - new Date(a ?? 0).getTime()
const byDateAsc = (a?: string, b?: string) =>
    new Date(a ?? 0).getTime() - new Date(b ?? 0).getTime()

export const JobStatusPage: React.FC = () => {
    const { jobs, isLoading, error, isFetching, dataUpdatedAt, refetch } =
        useJobs()
    const [selectedJob, setSelectedJob] = useState<EnhancedJob | null>(null)

    // Last / upcoming lists, mirroring the original tool's filtering. Excludes
    // HOUSEKEEPING and any currently-running job.
    const { lastJobs, upcomingJobs } = useMemo(() => {
        const idle = jobs.filter(
            (job) => job.jobType !== 'HOUSEKEEPING' && !job.isRunning
        )
        const lastJobs = idle
            .filter((job) => Boolean(job.lastExecutedStatus))
            .sort((a, b) => byDateDesc(a.lastFinished, b.lastFinished))
            .slice(0, MAX_LAST_JOBS)
        const upcomingJobs = idle
            .filter(
                (job) =>
                    job.jobStatus === 'SCHEDULED' &&
                    Boolean(job.nextExecutionTime)
            )
            .sort((a, b) => byDateAsc(a.nextExecutionTime, b.nextExecutionTime))
            .slice(0, MAX_UPCOMING_JOBS)
        return { lastJobs, upcomingJobs }
    }, [jobs])

    // Prefer the live entry so the modal tracks running state, but keep the
    // snapshot taken when it was opened: the server deletes finished once-off
    // jobs after a while, and the modal must not vanish while being read.
    const liveSelectedJob = selectedJob
        ? jobs.find((job) => job.id === selectedJob.id)
        : undefined
    const modalJob = liveSelectedJob ?? selectedJob

    const handleViewDetails = useCallback(
        (job: EnhancedJob) => setSelectedJob(job),
        []
    )

    if (isLoading) {
        return (
            <div className={styles.loading}>
                <CircularLoader />
            </div>
        )
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>{i18n.t('Background jobs')}</h1>
                <div className={styles.headerActions}>
                    <UpdatedAgo
                        dataUpdatedAt={dataUpdatedAt}
                        className={styles.updated}
                    />
                    <Button
                        small
                        secondary
                        loading={isFetching}
                        onClick={() => refetch()}
                    >
                        {i18n.t('Refresh')}
                    </Button>
                </div>
            </header>

            {error && (
                <div className={styles.error}>
                    <NoticeBox error title={i18n.t('Error loading jobs')}>
                        {error.message || i18n.t('An unknown error occurred')}
                    </NoticeBox>
                </div>
            )}

            <section className={styles.section}>
                <RunningJobs jobs={jobs} onViewDetails={handleViewDetails} />
            </section>

            <section className={`${styles.section} ${styles.lists}`}>
                <JobList
                    title={i18n.t('Last jobs')}
                    jobs={lastJobs}
                    variant="last"
                    onViewDetails={handleViewDetails}
                    emptyText={i18n.t('No recent jobs')}
                />
                <JobList
                    title={i18n.t('Upcoming jobs')}
                    jobs={upcomingJobs}
                    variant="upcoming"
                    onViewDetails={handleViewDetails}
                    emptyText={i18n.t('No upcoming jobs')}
                />
            </section>

            {modalJob && (
                <JobDetailsModal
                    job={modalJob}
                    jobExists={Boolean(liveSelectedJob)}
                    onClose={() => setSelectedJob(null)}
                />
            )}
        </div>
    )
}
