import i18n from '@dhis2/d2-i18n'
import { Card, Button } from '@dhis2/ui'
import React from 'react'
import styles from './JobList.module.css'
import { JobStatusTag } from '@/components/JobStatusTag'
import type { EnhancedJob } from '@/types/jobs'
import {
    formatDateTime,
    formatDuration,
    formatTimeUntil,
} from '@/utils/jobParsing'

type JobListProps = {
    title: string
    jobs: EnhancedJob[]
    variant: 'last' | 'upcoming'
    /** Current time, for relative "next run" display. */
    now: Date
    onViewDetails: (job: EnhancedJob) => void
    emptyText: string
}

export const JobList: React.FC<JobListProps> = ({
    title,
    jobs,
    variant,
    now,
    onViewDetails,
    emptyText,
}) => (
    <section className={styles.container}>
        <h3 className={styles.heading}>{title}</h3>
        {jobs.length === 0 ? (
            <p className={styles.empty}>{emptyText}</p>
        ) : (
            <ul className={styles.list}>
                {jobs.map((job) => (
                    <li key={job.id}>
                        <Card className={styles.item}>
                            <div className={styles.itemHeader}>
                                <strong className={styles.name}>
                                    {job.displayName}
                                </strong>
                                {variant === 'last' ? (
                                    <JobStatusTag
                                        status={job.lastExecutedStatus}
                                    />
                                ) : (
                                    <JobStatusTag status={job.jobStatus} />
                                )}
                            </div>
                            <dl className={styles.meta}>
                                <dt>{i18n.t('Type')}</dt>
                                <dd>{job.jobType}</dd>
                                {variant === 'last' ? (
                                    <>
                                        <dt>{i18n.t('ID')}</dt>
                                        <dd>{job.id}</dd>
                                        <dt>{i18n.t('Last executed')}</dt>
                                        <dd>
                                            {formatDateTime(job.lastExecuted)}
                                        </dd>
                                        <dt>{i18n.t('Last runtime')}</dt>
                                        <dd>
                                            {formatDuration(
                                                job.lastRuntimeExecution
                                            )}
                                        </dd>
                                    </>
                                ) : (
                                    <>
                                        <dt>{i18n.t('Next run')}</dt>
                                        <dd>
                                            {formatTimeUntil(
                                                job.nextExecutionTime,
                                                now
                                            )}
                                        </dd>
                                    </>
                                )}
                            </dl>
                            {variant === 'last' && (
                                <div className={styles.footer}>
                                    <Button
                                        small
                                        onClick={() => onViewDetails(job)}
                                    >
                                        {i18n.t('View details')}
                                    </Button>
                                </div>
                            )}
                        </Card>
                    </li>
                ))}
            </ul>
        )}
    </section>
)
