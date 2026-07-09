import { createContext, useContext } from 'react'
import type { SpectateContextValue } from './spectate-provider.types'

export const SpectateContext = createContext<SpectateContextValue | null>(null)

export function useSpectateContext(): SpectateContextValue {
  const context = useContext(SpectateContext)
  const isContextMissing = context === null
  if (isContextMissing) {
    throw new Error('useSpectate must be used within SpectateProvider')
  }
  return context
}
