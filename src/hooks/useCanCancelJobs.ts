import { useApiDataQuery } from '@/utils/useApiDataQuery'

/*
 * A user may cancel a running job if they are a superuser (ALL), hold
 * F_PERFORM_MAINTENANCE, or executed the job themselves (per the DHIS2
 * JobConfigurationController.checkExecutingUserOrAdmin check, v41-v43). We gate
 * the Cancel button on the two authority-based cases — the "executed it
 * themselves" case is per-job and rarely applies (scheduled jobs have no
 * per-user executor), so we keep the gate simple and conservative: a user who
 * lacks the authority never sees a button they can't use.
 */
const CANCEL_AUTHORITIES = ['ALL', 'F_PERFORM_MAINTENANCE']

/** Whether the current user is allowed to cancel jobs. */
export const useCanCancelJobs = (): boolean => {
    const { data } = useApiDataQuery<{ authorities: string[] }>({
        queryKey: ['me', 'authorities'],
        query: {
            resource: 'me',
            params: { fields: 'authorities' },
        },
        // Authorities don't change within a session.
        cacheTime: Infinity,
        staleTime: Infinity,
    })

    const authorities = data?.authorities ?? []
    return CANCEL_AUTHORITIES.some((authority) =>
        authorities.includes(authority)
    )
}
