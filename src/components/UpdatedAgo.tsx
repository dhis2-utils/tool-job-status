import i18n from '@dhis2/d2-i18n'
import React from 'react'
import { useNow } from '@/hooks/useNow'

export const formatUpdatedAgo = (dataUpdatedAt: number, now: Date): string => {
    if (!dataUpdatedAt) {
        return ''
    }
    const seconds = Math.max(
        0,
        Math.round((now.getTime() - dataUpdatedAt) / 1000)
    )
    // Avoid an interpolation param literally named `count`: the DHIS2 i18n
    // extractor treats it as a pluralization key and drops the string.
    if (seconds < 60) {
        return i18n.t('Updated {{seconds}}s ago', { seconds })
    }
    const minutes = Math.floor(seconds / 60)
    return i18n.t('Updated {{minutes}}m ago', { minutes })
}

/**
 * "Updated Ns ago" indicator. Owns its own one-second clock so only this span
 * re-renders every second, not the whole page.
 */
export const UpdatedAgo: React.FC<{
    dataUpdatedAt: number
    className?: string
}> = ({ dataUpdatedAt, className }) => {
    const now = useNow(1000)
    return (
        <span className={className}>
            {formatUpdatedAgo(dataUpdatedAt, now)}
        </span>
    )
}
