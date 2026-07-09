import { useAuth } from '../providers/auth-provider'

export function useIsWalletConnected(): boolean {
  const { ready, authenticated, walletReady } = useAuth()
  return ready && authenticated && walletReady
}
