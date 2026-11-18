import i18n from '@dhis2/d2-i18n'
import { Tag } from '@dhis2/ui'
import React from 'react'
import type { JobStatus } from '@/types/jobs'

/**
 * Map a DHIS2 job status onto a Tag colour. The Tag component only offers
 * positive/negative/neutral, so we collapse the original tool's five-colour
 * scheme accordingly (completed = green, failed/stopped = red, everything
 * else = neutral blue).
 */
const tagColorForStatus = (
    status: JobStatus | undefined
): { positive?: boolean; negative?: boolean; neutral?: boolean } => {
    switch (status) {
        case 'COMPLETED':
            return { positive: true }
        case 'FAILED':
        case 'STOPPED':
            return { negative: true }
        default:
            return { neutral: true }
    }
}

/**
 * Translatable labels for the statuses DHIS2 2.40-2.43 report. Functions, so
 * that i18n.t runs at render time, after the locale has loaded.
 */
const STATUS_LABELS: Record<string, () => string> = {
    RUNNING: () => i18n.t('Running'),
    SCHEDULED: () => i18n.t('Scheduled'),
    DISABLED: () => i18n.t('Disabled'),
    COMPLETED: () => i18n.t('Completed'),
    STOPPED: () => i18n.t('Stopped'),
    FAILED: () => i18n.t('Failed'),
    NOT_STARTED: () => i18n.t('Not started'),
}

/** A status this tool does not know is shown as the server sent it. */
const statusLabel = (status: JobStatus | undefined): string => {
    if (!status) {
        return i18n.t('Unknown')
    }
    return STATUS_LABELS[status]?.() ?? status
}

export const JobStatusTag: React.FC<{ status?: JobStatus }> = ({ status }) => (
    <Tag {...tagColorForStatus(status)}>{statusLabel(status)}</Tag>
)
