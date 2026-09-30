import i18n from '@dhis2/d2-i18n'
import { LinearLoader } from '@dhis2/ui'
import React from 'react'
import styles from './JobProgress.module.css'
import { useJobTasks } from '@/hooks/useJobTasks'
import { deriveJobProgress } from '@/utils/jobParsing'

type JobProgressProps = {
    jobType: string
    jobId: string
}

/**
 * Live progress line for a running job. Polls the authoritative per-job task
 * endpoint (see useJobTasks) rather than reading the shared global task map, so
 * no live detail is lost. Shows a percentage bar for LOOP-style progress and a
 * status message otherwise.
 */
export const JobProgress: React.FC<JobProgressProps> = ({ jobType, jobId }) => {
    const { tasks } = useJobTasks(jobType, jobId, { poll: true })
    const { percentage, text } = deriveJobProgress(tasks)

    return (
        <div className={styles.progress}>
            {percentage !== null && (
                <LinearLoader amount={percentage} className={styles.loader} />
            )}
            <div className={styles.text}>
                {/*
                 * Render the task message as a raw JSX child rather than an
                 * i18n interpolation value: task messages can contain quotes
                 * (e.g. Populating 'DATA_VALUE'), and i18next HTML-escapes
                 * interpolated values, which would surface as literal &#39;.
                 */}
                {percentage !== null ? (
                    <>
                        {text}
                        {' — '}
                        {i18n.t('{{percentage}}% complete', { percentage })}
                    </>
                ) : (
                    text
                )}
            </div>
        </div>
    )
}
