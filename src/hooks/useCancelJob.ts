import { useDataEngine, useAlert } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * Request cancellation of a running job via
 * `POST /api/jobConfigurations/{id}/cancel` (supported on DHIS2 v41-v43).
 *
 * Cancellation is cooperative/best-effort on the server side: the job stops at
 * its next checkpoint rather than being killed instantly, and work already done
 * is kept. On success we invalidate the job and task queries so the UI reflects
 * the new state on the next poll.
 */
export const useCancelJob = () => {
    const engine = useDataEngine()
    const queryClient = useQueryClient()

    const { show: showSuccess } = useAlert(
        i18n.t(
            'Cancellation requested — it can take a few seconds for the job to stop'
        ),
        { success: true }
    )
    const { show: showError } = useAlert(
        ({ message }: { message: string }) =>
            i18n.t('Could not cancel job: {{message}}', { message }),
        { critical: true }
    )

    const { mutate, isLoading } = useMutation<unknown, Error, string>(
        (jobId) =>
            engine.mutate({
                resource: `jobConfigurations/${jobId}/cancel`,
                type: 'create',
                data: {},
            }),
        {
            onSuccess: () => {
                showSuccess()
                queryClient.invalidateQueries({
                    queryKey: ['jobConfigurations'],
                })
                queryClient.invalidateQueries({ queryKey: ['systemTasks'] })
            },
            onError: (error) => {
                showError({
                    message: error.message || i18n.t('unknown error'),
                })
                console.error('Cancel job failed:', error)
            },
        }
    )

    return { cancelJob: mutate, isCancelling: isLoading }
}
