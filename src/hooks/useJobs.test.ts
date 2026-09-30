import { renderHook } from '@testing-library/react'
import { useJobs } from '@/hooks/useJobs'
import * as apiModule from '@/utils/useApiDataQuery'

jest.mock('@/utils/useApiDataQuery')

type QueryResult = Record<string, unknown>

const queryResult = (overrides: QueryResult): QueryResult => ({
    data: undefined,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    dataUpdatedAt: 0,
    refetch: jest.fn(),
    ...overrides,
})

/** Route the two queries by their query key. */
const mockQueries = (configs: QueryResult, tasks: QueryResult) => {
    jest.spyOn(apiModule, 'useApiDataQuery').mockImplementation((({
        queryKey,
    }: {
        queryKey: unknown[]
    }) =>
        queryKey[0] === 'jobConfigurations'
            ? queryResult(configs)
            : queryResult(
                  tasks
              )) as unknown as typeof apiModule.useApiDataQuery)
}

const completedJob = {
    id: 'job1',
    displayName: 'Analytics',
    jobType: 'ANALYTICS_TABLE',
    jobStatus: 'COMPLETED',
}
const staleRunningTask = { level: 'INFO', time: 't', completed: false }

afterEach(() => jest.restoreAllMocks())

describe('useJobs running-state derivation', () => {
    it('marks a job running when the global task map says so', () => {
        mockQueries(
            { data: { jobConfigurations: [completedJob] } },
            { data: { ANALYTICS_TABLE: { job1: [staleRunningTask] } } }
        )
        const { result } = renderHook(() => useJobs())
        expect(result.current.jobs[0].isRunning).toBe(true)
    })

    it('ignores a task map that failed to refresh so a finished job is not stuck running', () => {
        mockQueries(
            { data: { jobConfigurations: [completedJob] } },
            {
                data: { ANALYTICS_TABLE: { job1: [staleRunningTask] } },
                isError: true,
                error: new Error('timeout'),
            }
        )
        const { result } = renderHook(() => useJobs())
        expect(result.current.jobs[0].isRunning).toBe(false)
    })
})
