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

export const JobStatusTag: React.FC<{ status?: JobStatus }> = ({ status }) => (
    <Tag {...tagColorForStatus(status)}>{status || i18n.t('Unknown')}</Tag>
)
