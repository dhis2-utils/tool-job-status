import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { CancelJobButton } from '@/components/CancelJobButton'
import * as useCanCancelJobsModule from '@/hooks/useCanCancelJobs'
import * as useCancelJobModule from '@/hooks/useCancelJob'
import { renderWithProviders } from '@/test-utils'
import type { EnhancedJob } from '@/types/jobs'

jest.mock('@/hooks/useCancelJob')
jest.mock('@/hooks/useCanCancelJobs')

const job: EnhancedJob = {
    id: 'abc123',
    displayName: 'Nightly analytics',
    jobType: 'ANALYTICS_TABLE',
    jobStatus: 'RUNNING',
    isRunning: true,
}

const cancelSpy = jest.fn()

beforeEach(() => {
    jest.spyOn(useCancelJobModule, 'useCancelJob').mockReturnValue({
        cancelJob: cancelSpy,
        isCancelling: false,
    })
    jest.spyOn(useCanCancelJobsModule, 'useCanCancelJobs').mockReturnValue(true)
})

afterEach(() => jest.resetAllMocks())

describe('CancelJobButton', () => {
    it('renders nothing when the user lacks the authority', () => {
        jest.spyOn(useCanCancelJobsModule, 'useCanCancelJobs').mockReturnValue(
            false
        )
        const { container } = renderWithProviders(<CancelJobButton job={job} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('asks for confirmation before cancelling', async () => {
        const user = userEvent.setup()
        renderWithProviders(<CancelJobButton job={job} />)

        expect(screen.queryByText('Cancel this job?')).not.toBeInTheDocument()
        await user.click(screen.getByTestId('cancel-job-button'))
        expect(screen.getByText('Cancel this job?')).toBeInTheDocument()
        expect(cancelSpy).not.toHaveBeenCalled()
    })

    it('does not cancel when the user keeps the job running', async () => {
        const user = userEvent.setup()
        renderWithProviders(<CancelJobButton job={job} />)

        await user.click(screen.getByTestId('cancel-job-button'))
        await user.click(screen.getByRole('button', { name: 'Keep running' }))

        expect(cancelSpy).not.toHaveBeenCalled()
        expect(screen.queryByText('Cancel this job?')).not.toBeInTheDocument()
    })

    it('calls cancelJob with the job id on confirmation', async () => {
        const user = userEvent.setup()
        renderWithProviders(<CancelJobButton job={job} />)

        await user.click(screen.getByTestId('cancel-job-button'))
        const strip = screen.getByTestId('dhis2-uicore-buttonstrip')
        await user.click(
            within(strip).getByRole('button', { name: 'Cancel job' })
        )

        expect(cancelSpy).toHaveBeenCalledWith('abc123', expect.anything())
    })

    it('disables the button and shows "Cancelling…" after a successful request', async () => {
        // Make the mocked cancel invoke its success/settled callbacks.
        cancelSpy.mockImplementation((_id, opts) => {
            opts?.onSuccess?.()
            opts?.onSettled?.()
        })
        const user = userEvent.setup()
        renderWithProviders(<CancelJobButton job={job} />)

        await user.click(screen.getByTestId('cancel-job-button'))
        const strip = screen.getByTestId('dhis2-uicore-buttonstrip')
        await user.click(
            within(strip).getByRole('button', { name: 'Cancel job' })
        )

        const trigger = screen.getByTestId('cancel-job-button')
        expect(trigger).toBeDisabled()
        expect(trigger).toHaveTextContent('Cancelling…')
    })
})
