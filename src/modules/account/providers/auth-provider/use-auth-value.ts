import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ResultAsync } from 'neverthrow'
import type { AuthState } from './auth-provider.context'
import { createApiClient, type ApiClient } from '@/modules/shared/http'
import { toast } from '@/modules/shared/services/toast'
import { parseWalletAddress, type WalletAddress } from '@/modules/shared/domain'
import type { AuthError, WalletSource } from '../../domain/types'
import type { UseAuthValueInput } from './auth-provider.types'
import { coerceToAuthError, deriveWalletSource } from './auth-provider.utils'
import { clearPrivyStorage } from './clear-privy-storage'

function parsePrimaryWalletAddress(walletAddress: string | null): WalletAddress | null {
  if (walletAddress === null) return null
  const parsed = parseWalletAddress(walletAddress)
  return parsed.isOk() ? parsed.value : null
}

/**
 * Smart hook for the auth surface: owns the apiClient memo, the session-expired
 * effect, the connect-modal state, the Privy-handler wrappers, the derived
 * wallet facts, and the final `AuthState` value memo. `AuthValueProvider` is a
 * thin wrapper that calls this and publishes the result through `AuthContext`.
 *
 * Every input is an already-resolved Privy primitive injected by `AuthBridge`,
 * so this hook (and the provider) stays testable without a live `PrivyProvider`.
 */
export function useAuthValue(input: UseAuthValueInput): AuthState {
  const {
    apiBaseUrl,
    ready,
    authenticated,
    privyId,
    walletAddress,
    walletClientType,
    walletsReady,
    isBroadcastWalletReady,
    connectableMasterAddresses,
    externalWallets,
    exportableAddresses,
    hasMfa,
    getAccessToken,
    logout,
    enrollMfa,
    exportWallet,
    importPrivateKey,
    createAgentWallet,
    attachAgentSigner,
    removeAgentSigner,
    loginWithWallet,
    linkWallet,
    getMasterViemAccount,
    getBroadcastWalletClient,
    getAgentWalletBroadcastClient,
    switchMasterWalletChain,
  } = input

  // Distinguishes an involuntary session loss from a deliberate logout: a user
  // clicking "Log out" sets this before Privy flips `authenticated` to false, so
  // the session-loss observer below stays quiet for that transition.
  const deliberateLogoutRef = useRef(false)
  const wasAuthenticatedRef = useRef(false)

  const apiClient = useMemo<ApiClient>(
    () => createApiClient({ getAccessToken, baseUrl: apiBaseUrl }),
    [getAccessToken, apiBaseUrl],
  )

  const showSessionExpiredToast = useCallback(() => {
    toast.show({
      variant: 'error',
      title: 'Session expired',
      description: 'Sign in again to continue',
      durationMs: Number.POSITIVE_INFINITY,
      id: 'session-expired',
    })
  }, [])

  // An unrecoverable session (repeated 401 / null token / server TOKEN_INVALID)
  // means the stored token is dead and cannot be refreshed. Privy's `logout()`
  // only clears the *currently configured* app id's keys, so a stale key from a
  // previous app id would survive and keep the dead token in play. Purge every
  // `privy:` key after logout so the next login self-heals without a manual
  // "Clear site data".
  const resetStaleSession = useCallback(async (): Promise<void> => {
    await logout()
    clearPrivyStorage()
  }, [logout])

  useEffect(() => {
    return apiClient.subscribeToSessionExpired(() => {
      showSessionExpiredToast()
      void resetStaleSession()
    })
  }, [apiClient, resetStaleSession, showSessionExpiredToast])

  // Privy can invalidate a session on its own — a stale/unrecoverable refresh
  // token (e.g. the Privy user was deleted) flips `authenticated` to false
  // without any 401 reaching the apiClient, so the subscription above never
  // fires. Observe the true→false transition and surface the same toast, unless
  // the user logged out deliberately. Toast id de-dupes against the apiClient
  // path when both fire for the same loss.
  useEffect(() => {
    const sessionWasLost = wasAuthenticatedRef.current && !authenticated
    wasAuthenticatedRef.current = authenticated
    if (!sessionWasLost) return
    if (deliberateLogoutRef.current) {
      deliberateLogoutRef.current = false
      return
    }
    showSessionExpiredToast()
  }, [authenticated, showSessionExpiredToast])

  const wrappedLogout = useCallback((): Promise<void> => {
    deliberateLogoutRef.current = true
    return logout()
  }, [logout])

  const [isModalRequested, setIsModalRequested] = useState(false)
  const openConnectModal = useCallback(() => setIsModalRequested(true), [])
  const closeConnectModal = useCallback(() => setIsModalRequested(false), [])
  const isConnectModalOpen = isModalRequested && !authenticated

  const wrappedEnrollMfa = useCallback(
    (): ResultAsync<void, AuthError> =>
      ResultAsync.fromPromise(enrollMfa(), coerceToAuthError),
    [enrollMfa],
  )
  const wrappedLoginWithWallet = useCallback(
    (): ResultAsync<void, AuthError> =>
      ResultAsync.fromPromise(loginWithWallet(), coerceToAuthError),
    [loginWithWallet],
  )
  const wrappedLinkWallet = useCallback(
    (): ResultAsync<string, AuthError> =>
      ResultAsync.fromPromise(linkWallet(), coerceToAuthError),
    [linkWallet],
  )

  const walletReady = walletsReady && walletAddress !== null
  const walletSource: WalletSource | null =
    walletClientType === null ? null : deriveWalletSource(walletClientType)
  const primaryWalletAddress = parsePrimaryWalletAddress(walletAddress)

  return useMemo<AuthState>(
    () => ({
      ready,
      authenticated,
      privyId,
      walletAddress,
      primaryWalletAddress,
      walletSource,
      walletReady,
      isBroadcastWalletReady,
      connectableMasterAddresses,
      externalWallets,
      exportableAddresses,
      hasMfa,
      getAccessToken,
      logout: wrappedLogout,
      enrollMfa: wrappedEnrollMfa,
      exportWallet,
      importPrivateKey,
      createAgentWallet,
      attachAgentSigner,
      removeAgentSigner,
      loginWithWallet: wrappedLoginWithWallet,
      linkWallet: wrappedLinkWallet,
      openConnectModal,
      closeConnectModal,
      isConnectModalOpen,
      apiClient,
      getMasterViemAccount,
      getBroadcastWalletClient,
      getAgentWalletBroadcastClient,
      switchMasterWalletChain,
    }),
    [
      ready,
      authenticated,
      privyId,
      walletAddress,
      primaryWalletAddress,
      walletSource,
      walletReady,
      isBroadcastWalletReady,
      connectableMasterAddresses,
      externalWallets,
      exportableAddresses,
      hasMfa,
      getAccessToken,
      wrappedLogout,
      wrappedEnrollMfa,
      exportWallet,
      importPrivateKey,
      createAgentWallet,
      attachAgentSigner,
      removeAgentSigner,
      wrappedLoginWithWallet,
      wrappedLinkWallet,
      openConnectModal,
      closeConnectModal,
      isConnectModalOpen,
      apiClient,
      getMasterViemAccount,
      getBroadcastWalletClient,
      getAgentWalletBroadcastClient,
      switchMasterWalletChain,
    ],
  )
}
