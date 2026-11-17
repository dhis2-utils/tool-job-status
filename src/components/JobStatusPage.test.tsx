import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { JobStatusPage } from '@/components/JobStatusPage'
import * as useJobsModule from '@/hooks/useJobs'
import { renderWithProviders } from '@/test-utils'

jest.mock('@/hooks/useJobs')
// The details modal fetches task history; keep it inert for these tests.
jest.mock('@/hooks/useJobTasks', () => ({
    useJobTasks: () => ({ tasks: [], isLoading: false, error: null }),
}))
jest.mock('@/hooks/useCanCancelJobs', () => ({
    useCanCancelJobs: () => () => false,
}))

const mockUseJobs = (
    overrides: Partial<ReturnType<typeof useJobsModule.useJobs>>
) => {
    jest.spyOn(useJobsModule, 'useJobs').mockReturnValue({
        jobs: [],
        isLoading: false,
        isFetching: false,
        error: null,
        dataUpdatedAt: Date.now(),
        refetch: () => undefined,
        ...overrides,
    })
}

describe('JobStatusPage', () => {
    afterEach(() => jest.restoreAllMocks())

    it('shows a loader while the first fetch is in flight', () => {
        mockUseJobs({ isLoading: true })
        renderWithProviders(<JobStatusPage />)
        expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('shows an error notice when the fetch fails', () => {
        mockUseJobs({ error: new Error('Network down') })
        renderWithProviders(<JobStatusPage />)
        expect(screen.getByText('Error loading jobs')).toBeInTheDocument()
        expect(screen.getByText('Network down')).toBeInTheDocument()
    })

    it('renders the empty running state and the two job lists', () => {
        mockUseJobs({ jobs: [] })
        renderWithProviders(<JobStatusPage />)
        expect(screen.getByText('No running jobs')).toBeInTheDocument()
        expect(screen.getByText('Last jobs')).toBeInTheDocument()
        expect(screen.getByText('Upcoming jobs')).toBeInTheDocument()
    })

    it('leaves jobs that have never run out of Last jobs', () => {
        // DHIS2 reports lastExecutedStatus NOT_STARTED for a job that has
        // never run (seen on 2.40-2.43), with no lastExecuted.
        mockUseJobs({
            jobs: [
                {
                    id: 'ran',
                    displayName: 'Ran once',
                    jobType: 'DATA_STATISTICS',
                    jobStatus: 'DISABLED',
                    lastExecutedStatus: 'COMPLETED',
                    lastExecuted: '2026-09-03T10:00:00.000',
                    lastFinished: '2026-09-03T10:00:01.000',
                    isRunning: false,
                },
                {
                    id: 'never',
                    displayName: 'Never ran',
                    jobType: 'DATA_STATISTICS',
                    jobStatus: 'DISABLED',
                    lastExecutedStatus: 'NOT_STARTED',
                    isRunning: false,
                },
            ],
        })
        renderWithProviders(<JobStatusPage />)
        expect(screen.getByText('Ran once')).toBeInTheDocument()
        expect(screen.queryByText('Never ran')).not.toBeInTheDocument()
    })

    it('keeps the details modal open when the job disappears from the poll', async () => {
        const user = userEvent.setup()
        const job = {
            id: 'j1',
            displayName: 'Nightly import',
            jobType: 'METADATA_IMPORT',
            jobStatus: 'COMPLETED',
            lastExecutedStatus: 'COMPLETED',
            lastFinished: '2026-09-03T10:00:00.000',
            isRunning: false,
        }
        mockUseJobs({ jobs: [job] })
        const { rerender } = renderWithProviders(<JobStatusPage />)

        await user.click(screen.getByRole('button', { name: 'View details' }))
        expect(screen.getByText(/Job details/)).toBeInTheDocument()

        // The server cleaned the finished job up between two polls.
        mockUseJobs({ jobs: [] })
        rerender(<JobStatusPage />)

        expect(screen.getByText(/Job details/)).toBeInTheDocument()
        expect(
            screen.getByText('This job no longer exists on the server')
        ).toBeInTheDocument()
    })
})
