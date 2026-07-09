import { useSpectateProvider } from './use-spectate-provider'
import { SpectateContext } from './spectate-provider.context'
import type { SpectateProviderProps } from './spectate-provider.types'

export function SpectateProvider({ children, isWalletConnected = true }: SpectateProviderProps) {
  const state = useSpectateProvider(isWalletConnected)
  return <SpectateContext value={state}>{children}</SpectateContext>
}
