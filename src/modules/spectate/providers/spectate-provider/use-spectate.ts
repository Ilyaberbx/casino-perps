import { useSpectateContext } from './spectate-provider.context'
import type { SpectateContextValue } from './spectate-provider.types'

export function useSpectate(): SpectateContextValue {
  return useSpectateContext()
}
