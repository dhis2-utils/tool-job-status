import { CssReset, CssVariables } from '@dhis2/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import { JobStatusPage } from '@/components/JobStatusPage'
import { SyncUrlWithGlobalShell } from '@/utils/SyncUrlWithGlobalShell'
import './locales'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Job/task data is polled on an interval; a stale copy on window
            // focus adds nothing, so disable the refetch-on-focus default.
            refetchOnWindowFocus: false,
        },
    },
})

const router = createHashRouter([
    {
        element: <SyncUrlWithGlobalShell />,
        children: [
            {
                path: '/',
                element: <JobStatusPage />,
            },
        ],
    },
])

const App = () => (
    <QueryClientProvider client={queryClient}>
        <CssReset />
        <CssVariables theme spacers colors elevations />
        <RouterProvider router={router} />
    </QueryClientProvider>
)

export default App
