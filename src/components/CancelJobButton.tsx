import i18n from '@dhis2/d2-i18n'
import {
    Button,
    ButtonStrip,
    Modal,
    ModalActions,
    ModalContent,
    ModalTitle,
} from '@dhis2/ui'
import React, { useState } from 'react'
import styles from './CancelJobButton.module.css'
import { useCanCancelJobs } from '@/hooks/useCanCancelJobs'
import { useCancelJob } from '@/hooks/useCancelJob'
import type { EnhancedJob } from '@/types/jobs'

/**
 * Destructive "Cancel job" action for a running job, guarded by a confirmation
 * dialog so a job is never aborted by a stray click. Only rendered for users
 * authorized to cancel (see useCanCancelJobs). Once cancellation is requested
 * the button stays disabled ("Cancelling…") until the job stops — cancellation
 * is cooperative and takes a few seconds.
 */
export const CancelJobButton: React.FC<{ job: EnhancedJob }> = ({ job }) => {
    const canCancel = useCanCancelJobs()
    const { cancelJob, isCancelling } = useCancelJob()
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [cancelRequested, setCancelRequested] = useState(false)

    if (!canCancel) {
        return null
    }

    const confirm = () => {
        cancelJob(job.id, {
            onSuccess: () => setCancelRequested(true),
            onSettled: () => setConfirmOpen(false),
        })
    }

    return (
        <>
            <Button
                small
                destructive
                disabled={cancelRequested}
                onClick={() => setConfirmOpen(true)}
                dataTest="cancel-job-button"
            >
                {cancelRequested ? i18n.t('Cancelling…') : i18n.t('Cancel job')}
            </Button>

            {confirmOpen && (
                <Modal small onClose={() => setConfirmOpen(false)}>
                    <ModalTitle>{i18n.t('Cancel this job?')}</ModalTitle>
                    <ModalContent>
                        <p className={styles.text}>
                            {i18n.t(
                                'This asks the server to stop the running job. It stops at its next checkpoint, which can take a few seconds; work already completed is kept.'
                            )}
                        </p>
                        {/* Render the job name outside i18n interpolation so
                            names containing quotes are not HTML-escaped. */}
                        <p className={styles.jobName}>{job.displayName}</p>
                    </ModalContent>
                    <ModalActions>
                        <ButtonStrip end>
                            <Button
                                secondary
                                onClick={() => setConfirmOpen(false)}
                                disabled={isCancelling}
                            >
                                {i18n.t('Keep running')}
                            </Button>
                            <Button
                                destructive
                                loading={isCancelling}
                                onClick={confirm}
                            >
                                {i18n.t('Cancel job')}
                            </Button>
                        </ButtonStrip>
                    </ModalActions>
                </Modal>
            )}
        </>
    )
}
