import '@testing-library/jest-dom'
import { configure } from '@testing-library/react'

// @dhis2/ui components expose test hooks via `data-test`, not `data-testid`.
configure({ testIdAttribute: 'data-test' })
