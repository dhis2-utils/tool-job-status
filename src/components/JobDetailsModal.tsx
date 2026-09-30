import i18n from '@dhis2/d2-i18n'
import {
    Modal,
    ModalTitle,
    ModalContent,
    ModalActions,
    Button,
    ButtonStrip,
    CircularLoader,
    NoticeBox,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    TableCellHead,
} from '@dhis2/ui'
import React from 'react'
import styles from './JobDetailsModal.module.css'
import { useJobTasks } from '@/hooks/useJobTasks'
import type { EnhancedJob } from '@/types/jobs'
import {
    findPredictionSummary,
    formatDateTime,
    predictionSummaryRows,
} from '@/utils/jobParsing'

type JobDetailsModalProps = {
    job: EnhancedJob
    onClose: () => void
}

const MAX_HISTORY = 5

export const JobDetailsModal: React.FC<JobDetailsModalProps> = ({
    job,
    onClose,
}) => {
    // Poll only while the job is running; a finished job's history is static.
    const { tasks, isLoading, error } = useJobTasks(job.jobType, job.id, {
        enabled: true,
        poll: job.isRunning,
    })

    const predictionSummary =
        job.jobType === 'PREDICTOR' ? findPredictionSummary(tasks) : null

    const history = (tasks ?? [])
        .filter((task) => Boolean(task.message))
        .slice(0, MAX_HISTORY)

    return (
        <Modal onClose={onClose} large position="middle">
            <ModalTitle>
                {i18n.t('Job details')}
                {job.displayName ? ` — ${job.displayName}` : ''}
            </ModalTitle>
            <ModalContent>
                {isLoading && (
                    <div className={styles.center}>
                        <CircularLoader small />
                    </div>
                )}

                {error && (
                    <NoticeBox
                        error
                        title={i18n.t('Error loading task details')}
                    >
                        {error.message || i18n.t('An unknown error occurred')}
                    </NoticeBox>
                )}

                {!isLoading && !error && (
                    <>
                        {predictionSummary && (
                            <Table className={styles.summary}>
                                <TableHead>
                                    <TableRow>
                                        <TableCellHead colSpan="2">
                                            {i18n.t('Prediction summary')}
                                        </TableCellHead>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {predictionSummaryRows(
                                        predictionSummary
                                    ).map(({ label, value }) => (
                                        <TableRow key={label}>
                                            <TableCell>{label}</TableCell>
                                            <TableCell>{value}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}

                        {history.length > 0 ? (
                            <ul className={styles.history}>
                                {history.map((task, index) => (
                                    <li
                                        key={task.uid || task.id || index}
                                        className={styles.entry}
                                    >
                                        {task.time && (
                                            <span className={styles.time}>
                                                {formatDateTime(task.time)}
                                            </span>
                                        )}
                                        <span className={styles.message}>
                                            {task.message}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className={styles.empty}>
                                {i18n.t('No task details available')}
                            </p>
                        )}
                    </>
                )}
            </ModalContent>
            <ModalActions>
                <ButtonStrip end>
                    <Button onClick={onClose}>{i18n.t('Close')}</Button>
                </ButtonStrip>
            </ModalActions>
        </Modal>
    )
}
