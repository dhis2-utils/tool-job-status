import { useEffect, useState } from 'react'

/**
 * Returns the current time, refreshed every `intervalMs`. Used for relative
 * time displays ("updated 3s ago", "next run in 2h") that must tick without a
 * data refetch. Scoped to the small components that show relative time so the
 * whole page doesn't re-render every second.
 */
export const useNow = (intervalMs = 1000): Date => {
    const [now, setNow] = useState(() => new Date())

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), intervalMs)
        return () => clearInterval(id)
    }, [intervalMs])

    return now
}
