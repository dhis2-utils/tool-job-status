import i18n from '@dhis2/d2-i18n'
import { Button, CircularLoader, NoticeBox } from '@dhis2/ui'
import React, { useCallback, useMemo, useState } from 'react'
import styles from './JobStatusPage.module.css'
import { JobDetailsModal } from '@/components/JobDetailsModal'
import { JobList } from '@/components/JobList'
import { RunningJobs } from '@/components/RunningJobs'
import { useJobs } from '@/hooks/useJobs'
import { useNow } from '@/hooks/useNow'
import type { EnhancedJob } from '@/types/jobs'

const MAX_LAST_JOBS = 6
const MAX_UPCOMING_JOBS = 10

const byDateDesc = (a?: string, b?: string) =>
    new Date(b ?? 0).getTime() - new Date(a ?? 0).getTime()
const byDateAsc = (a?: string, b?: string) =>
    new Date(a ?? 0).getTime() - new Date(b ?? 0).getTime()

const formatUpdatedAgo = (dataUpdatedAt: number, now: Date): string => {
    if (!dataUpdatedAt) {
        return ''
    }
    const seconds = Math.max(
        0,
        Math.round((now.getTime() - dataUpdatedAt) / 1000)
    )
    // Avoid an interpolation param literally named `count`: the DHIS2 i18n
    // extractor treats it as a pluralization key and drops the string.
    if (seconds < 60) {
        return i18n.t('Updated {{seconds}}s ago', { seconds })
    }
    const minutes = Math.floor(seconds / 60)
    return i18n.t('Updated {{minutes}}m ago', { minutes })
}

export const JobStatusPage: React.FC = () => {
    const { jobs, isLoading, error, isFetching, dataUpdatedAt, refetch } =
        useJobs()
    const now = useNow(1000)
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

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

    // Look the selected job up from the live list (rather than storing a
    // snapshot) so the modal reflects up-to-date running state.
    const selectedJob: EnhancedJob | null =
        jobs.find((job) => job.id === selectedJobId) ?? null

    const handleViewDetails = useCallback(
        (job: EnhancedJob) => setSelectedJobId(job.id),
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
                    <span className={styles.updated}>
                        {formatUpdatedAgo(dataUpdatedAt, now)}
                    </span>
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
                    now={now}
                    onViewDetails={handleViewDetails}
                    emptyText={i18n.t('No recent jobs')}
                />
                <JobList
                    title={i18n.t('Upcoming jobs')}
                    jobs={upcomingJobs}
                    variant="upcoming"
                    now={now}
                    onViewDetails={handleViewDetails}
                    emptyText={i18n.t('No upcoming jobs')}
                />
            </section>

            {selectedJob && (
                <JobDetailsModal
                    job={selectedJob}
                    onClose={() => setSelectedJobId(null)}
                />
            )}
        </div>
    )
}
