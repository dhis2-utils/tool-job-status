import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { RunningJobs } from '@/components/RunningJobs'
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
    useCanCancelJobs: () => () => true,
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
        render(<RunningJobs jobs={[]} onViewDetails={() => undefined} />)
        expect(screen.getByText('No running jobs')).toBeInTheDocument()
    })

    it('excludes HOUSEKEEPING from the running view', () => {
        render(
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

    it('shows a job outside any queue under "Now running", without a group label', () => {
        render(
            <RunningJobs
                jobs={[job({ displayName: 'Lonely job' })]}
                onViewDetails={() => undefined}
            />
        )
        expect(
            screen.getByRole('heading', { name: 'Now running' })
        ).toBeInTheDocument()
        expect(screen.getByText('Lonely job')).toBeInTheDocument()
        expect(screen.queryByText('Not in a queue')).not.toBeInTheDocument()
    })

    it('labels queues and jobs outside a queue under one "Now running" heading', () => {
        render(
            <RunningJobs
                jobs={[
                    job({
                        id: 'q1',
                        displayName: 'Step',
                        queueName: 'Nightly',
                    }),
                    job({ id: 'solo', displayName: 'Analytics run' }),
                ]}
                onViewDetails={() => undefined}
            />
        )
        expect(
            screen.getAllByRole('heading', { name: 'Now running' })
        ).toHaveLength(1)
        expect(
            screen.getByRole('heading', { name: 'Queue Nightly' })
        ).toBeInTheDocument()
        expect(
            screen.getByRole('heading', { name: 'Not in a queue' })
        ).toBeInTheDocument()
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
        render(<RunningJobs jobs={jobs} onViewDetails={() => undefined} />)
        expect(
            screen.getByRole('heading', { name: 'Queue nightly' })
        ).toBeInTheDocument()
        expect(screen.getByText('First')).toBeInTheDocument()
        expect(screen.getByText('Second')).toBeInTheDocument()
        expect(screen.getByText('Job 1 of 2')).toBeInTheDocument()
        expect(screen.getByText('Job 2 of 2')).toBeInTheDocument()
    })

    it('shows View details only when the server holds details for the job', () => {
        render(
            <RunningJobs
                jobs={[
                    job({ id: 'with', displayName: 'With', hasDetails: true }),
                    job({
                        id: 'without',
                        displayName: 'Without',
                        hasDetails: false,
                    }),
                    job({ id: 'unknown', displayName: 'Unknown yet' }),
                ]}
                onViewDetails={() => undefined}
            />
        )
        // Shown when there are details, and when it is not known yet.
        expect(
            screen.getAllByRole('button', { name: 'View details' })
        ).toHaveLength(2)
    })

    it('keeps the job parameters collapsed until asked for', async () => {
        const user = userEvent.setup()
        render(
            <RunningJobs
                jobs={[
                    job({
                        jobType: 'ANALYTICS_TABLE',
                        displayName: 'Analytics',
                        jobParameters: { lastYears: 2 },
                    }),
                ]}
                onViewDetails={() => undefined}
            />
        )
        const firstRow = screen.getByText('DATA_VALUE')
        expect(firstRow).not.toBeVisible()
        await user.click(screen.getByText('Parameters'))
        expect(firstRow).toBeVisible()
    })

    it('leaves out the parameters toggle for a job without parameters', () => {
        render(
            <RunningJobs
                jobs={[job({ jobParameters: {} })]}
                onViewDetails={() => undefined}
            />
        )
        expect(screen.queryByText('Parameters')).not.toBeInTheDocument()
        expect(
            screen.queryByText('No parameters available')
        ).not.toBeInTheDocument()
    })
})
