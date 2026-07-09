import { useCallback, useContext } from 'react'
import type { To } from 'react-router-dom'
import { SpectateContext } from '../providers/spectate-provider/spectate-provider.context'
import { SPECTATE_QUERY_PARAM } from '../providers/spectate-provider/spectate-provider.constants'

// Builds a `To` that carries the active spectate session forward across navigation.
// Spectate is a URL-only session (`?spectate=`), so a plain `<NavLink to="/portfolio">`
// drops it; route nav links through this builder to keep the session alive. Only the
// spectate param is preserved — other params (e.g. trade's `?market=`) are not leaked.
//
// Reads the context directly (not via useSpectate, which throws) so links are inert
// when no SpectateProvider is mounted — mirrors SpectateBanner, keeping isolated
// routing tests provider-free.
export function useSpectateLink(): (pathname: string) => To {
  const spectate = useContext(SpectateContext)
  const spectatedAddress = spectate?.spectatedAddress ?? null

  return useCallback(
    (pathname: string) => {
      if (spectatedAddress === null) return pathname
      const search = new URLSearchParams({ [SPECTATE_QUERY_PARAM]: spectatedAddress })
      return { pathname, search: search.toString() }
    },
    [spectatedAddress],
  )
}
