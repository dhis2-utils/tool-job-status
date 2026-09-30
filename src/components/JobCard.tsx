import i18n from '@dhis2/d2-i18n'
import { Card, Button } from '@dhis2/ui'
import React from 'react'
import styles from './JobCard.module.css'
import { CancelJobButton } from '@/components/CancelJobButton'
import {
    AnalyticsParametersTable,
    GenericParametersTable,
} from '@/components/JobParametersTable'
import { JobProgress } from '@/components/JobProgress'
import { JobStatusTag } from '@/components/JobStatusTag'
import type { EnhancedJob } from '@/types/jobs'
import { formatDateTime, formatDuration } from '@/utils/jobParsing'

/** A manual analytics run is named e.g. "ANALYTICS_TABLE (1)". */
const ANALYTICS_MANUAL_TITLE_REGEX = /^ANALYTICS_TABLE \(\d+\)$/

type JobCardProps = {
    job: EnhancedJob
    /** 1-based position within a queue, when rendered inside one. */
    queuePosition?: { index: number; total: number }
    onViewDetails: (job: EnhancedJob) => void
}

export const JobCard: React.FC<JobCardProps> = ({
    job,
    queuePosition,
    onViewDetails,
}) => {
    const isAnalytics = job.jobType === 'ANALYTICS_TABLE'

    const displayName =
        isAnalytics && ANALYTICS_MANUAL_TITLE_REGEX.test(job.displayName)
            ? i18n.t('Analytics table (manual run)')
            : job.displayName

    // The analytics job parameter is `lastYears` (the original tool read the
    // non-existent `years`, so it always showed "All").
    const years = job.jobParameters?.lastYears ?? job.jobParameters?.years

    return (
        <div
            className={`${styles.card} ${isAnalytics ? styles.analytics : ''}`}
            data-test="job-card"
            data-job-id={job.id}
        >
            <Card className={styles.inner}>
                {queuePosition && (
                    <div className={styles.position}>
                        {i18n.t('Job {{index}} of {{total}}', {
                            index: queuePosition.index,
                            total: queuePosition.total,
                        })}
                    </div>
                )}

                <div className={styles.header}>
                    <h3 className={styles.title}>{displayName}</h3>
                    <JobStatusTag status={job.jobStatus} />
                </div>

                <dl className={styles.meta}>
                    {isAnalytics ? (
                        <>
                            <dt>{i18n.t('ID')}</dt>
                            <dd>{job.id}</dd>
                            <dt>{i18n.t('Years')}</dt>
                            <dd>{years ?? i18n.t('All')}</dd>
                        </>
                    ) : (
                        <>
                            <dt>{i18n.t('Job type')}</dt>
                            <dd>{job.jobType}</dd>
                            <dt>{i18n.t('Last executed')}</dt>
                            <dd>{formatDateTime(job.lastExecuted)}</dd>
                            <dt>{i18n.t('Last runtime')}</dt>
                            <dd>{formatDuration(job.lastRuntimeExecution)}</dd>
                        </>
                    )}
                </dl>

                {isAnalytics ? (
                    <AnalyticsParametersTable params={job.jobParameters} />
                ) : (
                    <GenericParametersTable params={job.jobParameters} />
                )}

                {job.isRunning && (
                    <JobProgress jobType={job.jobType} jobId={job.id} />
                )}

                <div className={styles.footer}>
                    {job.isRunning && <CancelJobButton job={job} />}
                    <Button small onClick={() => onViewDetails(job)}>
                        {i18n.t('View details')}
                    </Button>
                </div>
            </Card>
        </div>
    )
}
