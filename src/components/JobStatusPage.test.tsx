import { screen } from '@testing-library/react'
import React from 'react'
import { JobStatusPage } from '@/components/JobStatusPage'
import * as useJobsModule from '@/hooks/useJobs'
import { renderWithProviders } from '@/test-utils'

jest.mock('@/hooks/useJobs')

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
})
