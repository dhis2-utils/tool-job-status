import { render } from '@testing-library/react'
import React from 'react'

/**
 * Thin render wrapper for component tests. The components under test take their
 * data via hooks that the tests mock (useJobs / useJobTasks), so no
 * app-runtime or TanStack context is needed — @dhis2/ui components render on
 * their own.
 */
export const renderWithProviders = (ui: React.ReactElement) => render(ui)
