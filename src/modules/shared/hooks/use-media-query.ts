import { useCallback, useSyncExternalStore } from 'react'

/**
 * Generic SSR-safe `matchMedia` subscription via `useSyncExternalStore` (so it
 * stays correct when `query` changes and avoids synchronous setState-in-effect).
 * `use-is-mobile` is the app-wide mobile boundary; reach for this when a
 * component needs a *different* breakpoint (e.g. the narrow app-shell header
 * condense) without minting a bespoke hook each time.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => {}
      }
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(query).matches
  }, [query])

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
