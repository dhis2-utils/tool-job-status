import { screen } from '@testing-library/react'
import React from 'react'
import { RunningJobs } from '@/components/RunningJobs'
import { renderWithProviders } from '@/test-utils'
import type { EnhancedJob } from '@/types/jobs'

// JobProgress polls the per-job endpoint and CancelJobButton mutates via the
// data engine; stub both so these tests stay presentational.
jest.mock('@/hooks/useJobTasks', () => ({
    useJobTasks: () => ({
        tasks: [],
        isLoading: false,
        isFetching: false,
        error: null,
    }),
}))
jest.mock('@/hooks/useCancelJob', () => ({
    useCancelJob: () => ({ cancelJob: jest.fn(), isCancelling: false }),
}))
jest.mock('@/hooks/useCanCancelJobs', () => ({
    useCanCancelJobs: () => true,
}))

const job = (overrides: Partial<EnhancedJob>): EnhancedJob => ({
    id: 'job1',
    displayName: 'A job',
    jobType: 'DATA_STATISTICS',
    jobStatus: 'RUNNING',
    isRunning: true,
    ...overrides,
})

describe('RunningJobs', () => {
    it('shows the empty state when nothing is running', () => {
        renderWithProviders(
            <RunningJobs jobs={[]} onViewDetails={() => undefined} />
        )
        expect(screen.getByText('No running jobs')).toBeInTheDocument()
    })

    it('excludes HOUSEKEEPING from the running view', () => {
        renderWithProviders(
            <RunningJobs
                jobs={[
                    job({
                        id: 'hk',
                        jobType: 'HOUSEKEEPING',
                        displayName: 'Housekeeping',
                    }),
                ]}
                onViewDetails={() => undefined}
            />
        )
        expect(screen.getByText('No running jobs')).toBeInTheDocument()
    })

    it('renders an independent running job under "Now running"', () => {
        renderWithProviders(
            <RunningJobs
                jobs={[job({ displayName: 'Lonely job' })]}
                onViewDetails={() => undefined}
            />
        )
        expect(screen.getByText('Now running')).toBeInTheDocument()
        expect(screen.getByText('Lonely job')).toBeInTheDocument()
    })

    it('groups queued jobs and shows position labels', () => {
        const jobs = [
            job({
                id: 'q1',
                displayName: 'First',
                queueName: 'nightly',
                queuePosition: 0,
                isRunning: true,
            }),
            job({
                id: 'q2',
                displayName: 'Second',
                queueName: 'nightly',
                queuePosition: 1,
                isRunning: false,
                jobStatus: 'SCHEDULED',
            }),
        ]
        renderWithProviders(
            <RunningJobs jobs={jobs} onViewDetails={() => undefined} />
        )
        expect(screen.getByText('nightly')).toBeInTheDocument()
        expect(screen.getByText('First')).toBeInTheDocument()
        expect(screen.getByText('Second')).toBeInTheDocument()
        expect(screen.getByText('Job 1 of 2')).toBeInTheDocument()
        expect(screen.getByText('Job 2 of 2')).toBeInTheDocument()
    })
})
