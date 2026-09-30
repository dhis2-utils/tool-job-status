import { useConfig } from '@dhis2/app-runtime'
import { useCallback } from 'react'
import type { JobConfiguration } from '@/types/jobs'
import { useApiDataQuery } from '@/utils/useApiDataQuery'

/*
 * Mirrors the server-side check in JobConfigurationController
 * (checkExecutingUserOrAdmin, identical on DHIS2 v41-v43): a user may cancel a
 * running job if they are a superuser (ALL), hold F_PERFORM_MAINTENANCE, or
 * are the user who executed the job (`executedBy`, set for manually triggered
 * and async import jobs). The gate is conservative: until the current user has
 * loaded, nobody can cancel.
 *
 * DHIS2 2.40 has no `POST /jobConfigurations/{uid}/cancel` endpoint (the
 * request falls through to the generic collection handler and 404s), so the
 * action is hidden entirely there.
 */
const CANCEL_AUTHORITIES = ['ALL', 'F_PERFORM_MAINTENANCE']
const MIN_SERVER_MINOR_WITH_CANCEL = 41

type Me = { id: string; authorities: string[] }

/** Returns a predicate telling whether the current user may cancel a job. */
export const useCanCancelJobs = (): ((job: JobConfiguration) => boolean) => {
    const { serverVersion } = useConfig()
    const serverSupportsCancel =
        (serverVersion?.minor ?? 0) >= MIN_SERVER_MINOR_WITH_CANCEL

    const { data: me } = useApiDataQuery<Me>({
        queryKey: ['me', 'id-authorities'],
        query: {
            resource: 'me',
            params: { fields: 'id,authorities' },
        },
        // Identity and authorities don't change within a session.
        cacheTime: Infinity,
        staleTime: Infinity,
    })

    return useCallback(
        (job: JobConfiguration) => {
            if (!serverSupportsCancel || !me) {
                return false
            }
            const hasAuthority = CANCEL_AUTHORITIES.some((authority) =>
                me.authorities?.includes(authority)
            )
            return (
                hasAuthority || (!!job.executedBy && job.executedBy === me.id)
            )
        },
        [me, serverSupportsCancel]
    )
}
