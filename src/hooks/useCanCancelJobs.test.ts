import { renderHook } from '@testing-library/react'
import { useCanCancelJobs } from '@/hooks/useCanCancelJobs'
import type { EnhancedJob } from '@/types/jobs'
import * as apiModule from '@/utils/useApiDataQuery'

jest.mock('@/utils/useApiDataQuery')

let mockServerMinor = 41
jest.mock('@dhis2/app-runtime', () => ({
    useConfig: () => ({ serverVersion: { major: 2, minor: mockServerMinor } }),
}))

const mockMe = (me: { id: string; authorities: string[] } | undefined) => {
    jest.spyOn(apiModule, 'useApiDataQuery').mockReturnValue({
        data: me,
    } as ReturnType<typeof apiModule.useApiDataQuery>)
}

const job = (executedBy?: string): EnhancedJob => ({
    id: 'j1',
    displayName: 'Import',
    jobType: 'METADATA_IMPORT',
    isRunning: true,
    executedBy,
})

afterEach(() => {
    jest.restoreAllMocks()
    mockServerMinor = 41
})

describe('useCanCancelJobs', () => {
    it('allows a user with F_PERFORM_MAINTENANCE to cancel any job', () => {
        mockMe({ id: 'u1', authorities: ['F_PERFORM_MAINTENANCE'] })
        const { result } = renderHook(() => useCanCancelJobs())
        expect(result.current(job('someone-else'))).toBe(true)
    })

    it('allows the user who executed the job to cancel it', () => {
        mockMe({ id: 'u1', authorities: ['F_METADATA_IMPORT'] })
        const { result } = renderHook(() => useCanCancelJobs())
        expect(result.current(job('u1'))).toBe(true)
    })

    it('denies a user without authority who did not execute the job', () => {
        mockMe({ id: 'u1', authorities: ['F_METADATA_IMPORT'] })
        const { result } = renderHook(() => useCanCancelJobs())
        expect(result.current(job('u2'))).toBe(false)
        expect(result.current(job(undefined))).toBe(false)
    })

    it('denies everyone on DHIS2 2.40, which has no cancel endpoint', () => {
        mockServerMinor = 40
        mockMe({ id: 'u1', authorities: ['ALL'] })
        const { result } = renderHook(() => useCanCancelJobs())
        expect(result.current(job('u1'))).toBe(false)
    })

    it('denies everything until the current user has loaded', () => {
        mockMe(undefined)
        const { result } = renderHook(() => useCanCancelJobs())
        expect(result.current(job('u1'))).toBe(false)
    })
})
