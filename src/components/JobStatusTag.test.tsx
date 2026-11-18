import { render, screen } from '@testing-library/react'
import React from 'react'
import { JobStatusTag } from '@/components/JobStatusTag'

describe('JobStatusTag', () => {
    it.each([
        ['RUNNING', 'Running'],
        ['SCHEDULED', 'Scheduled'],
        ['DISABLED', 'Disabled'],
        ['COMPLETED', 'Completed'],
        ['STOPPED', 'Stopped'],
        ['FAILED', 'Failed'],
        ['NOT_STARTED', 'Not started'],
    ])('shows %s as the translatable label "%s"', (status, label) => {
        render(<JobStatusTag status={status} />)
        expect(screen.getByText(label)).toBeInTheDocument()
    })

    it('shows a status it does not know as the server sent it', () => {
        render(<JobStatusTag status="SOME_NEW_STATUS" />)
        expect(screen.getByText('SOME_NEW_STATUS')).toBeInTheDocument()
    })

    it('shows "Unknown" without a status', () => {
        render(<JobStatusTag />)
        expect(screen.getByText('Unknown')).toBeInTheDocument()
    })
})
