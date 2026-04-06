import { useSyncExternalStore } from 'react'

function getMatches(query: string): boolean {
  return typeof window !== 'undefined' ? window.matchMedia(query).matches : false
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') return () => {}
      const mql = window.matchMedia(query)
      const handler = () => onStoreChange()
      mql.addEventListener('change', handler)
      return () => mql.removeEventListener('change', handler)
    },
    () => getMatches(query),
    () => false,
  )
}

/** True when viewport is < 1280px (tablets including iPad Air/Pro landscape) */
export function useIsTablet(): boolean {
  return useMediaQuery('(max-width: 1279px)')
}
