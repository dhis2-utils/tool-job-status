import i18n from '@dhis2/d2-i18n'
import {
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    TableCellHead,
} from '@dhis2/ui'
import React from 'react'
import styles from './JobParametersTable.module.css'
import type { JobParameters } from '@/types/jobs'
import {
    analyticsParamRows,
    analyticsSkippedPrograms,
} from '@/utils/jobParsing'

/** Render an arbitrary value from jobParameters as readable text. */
const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) {
        return ''
    }
    if (Array.isArray(value)) {
        return value.join(', ')
    }
    if (typeof value === 'object') {
        return JSON.stringify(value)
    }
    return String(value)
}

/** Generic key/value table of all job parameters (non-analytics jobs). */
export const GenericParametersTable: React.FC<{
    params?: JobParameters
}> = ({ params }) => {
    const entries = Object.entries(params ?? {})
    if (entries.length === 0) {
        return (
            <p className={styles.empty}>{i18n.t('No parameters available')}</p>
        )
    }

    return (
        <Table className={styles.table}>
            <TableHead>
                <TableRow>
                    <TableCellHead>{i18n.t('Parameter')}</TableCellHead>
                    <TableCellHead>{i18n.t('Value')}</TableCellHead>
                </TableRow>
            </TableHead>
            <TableBody>
                {entries.map(([key, value]) => (
                    <TableRow key={key}>
                        <TableCell>{key}</TableCell>
                        <TableCell>{formatValue(value)}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}

/**
 * Analytics-table parameter breakdown: which table types are included/skipped,
 * plus any skipped programs. Mirrors the original tool's element list.
 */
export const AnalyticsParametersTable: React.FC<{
    params?: JobParameters
}> = ({ params }) => {
    const rows = analyticsParamRows(params)
    const skippedPrograms = analyticsSkippedPrograms(params)

    return (
        <Table className={styles.table}>
            <TableHead>
                <TableRow>
                    <TableCellHead>{i18n.t('Element')}</TableCellHead>
                    <TableCellHead>{i18n.t('Included')}</TableCellHead>
                </TableRow>
            </TableHead>
            <TableBody>
                {rows.map(({ element, included }) => (
                    <TableRow key={element}>
                        <TableCell>{element}</TableCell>
                        <TableCell>
                            {included ? i18n.t('Yes') : i18n.t('No')}
                        </TableCell>
                    </TableRow>
                ))}
                <TableRow>
                    <TableCell>{i18n.t('Skipped programs')}</TableCell>
                    <TableCell>{skippedPrograms.join(', ')}</TableCell>
                </TableRow>
            </TableBody>
        </Table>
    )
}
