import { useEffect, useRef } from 'react'
import { useCreateWallet, type User } from '@privy-io/react-auth'
import { toast } from '@/modules/shared/services/toast'
import { logger } from '@/app/logger'

// Privy's embedded-wallet client types (the Native wallet). `privy-v2` is the
// newer key; both denote a Privy-managed embedded wallet, never an external one.
const EMBEDDED_WALLET_CLIENT_TYPES = ['privy', 'privy-v2']

// `PrivyErrorCode` is a const enum (no runtime export), so its members are
// compared by their literal string value rather than the imported symbol.
const EMBEDDED_WALLET_ALREADY_EXISTS_CODE = 'embedded_wallet_already_exists'

/**
 * Fallback embedded-wallet provisioning.
 *
 * The app relies on Privy's `createOnLogin: 'users-without-wallets'`
 * (`AuthProvider`) to mint the Native (embedded) wallet at email login. When
 * that auto-create is suppressed upstream — e.g. embedded wallets are disabled
 * for the app in the Privy dashboard — an authenticated user is left with NO
 * wallet at all: `user.wallet` stays null, `walletReady` never flips true,
 * onboarding never calls `getMe`/`onboard`, and the UI dead-ends "disconnected"
 * with no row in `users`.
 *
 * This hook closes that gap: once Privy has settled, if an authenticated user
 * has no usable wallet it explicitly creates the embedded wallet (once per
 * user), and surfaces a clear error toast if the creation itself is rejected —
 * so a dashboard misconfiguration is visible instead of a silent dead-end.
 */
export function useEnsureEmbeddedWallet(input: {
  ready: boolean
  authenticated: boolean
  walletsReady: boolean
  user: User | null
}): void {
  const { ready, authenticated, walletsReady, user } = input
  const attemptedForUserRef = useRef<string | null>(null)

  const { createWallet } = useCreateWallet({
    onError: (error) => {
      const isBenignAlreadyExists = String(error) === EMBEDDED_WALLET_ALREADY_EXISTS_CODE
      if (isBenignAlreadyExists) return
      logger.child({ module: 'auth' }).error({ errorCode: error }, 'embedded wallet creation failed')
      toast.show({
        variant: 'error',
        title: 'Wallet setup failed',
        description: 'We couldn’t set up your wallet. Please try again, or contact support if it persists.',
        id: 'embedded-wallet-create-failed',
      })
    },
  })

  useEffect(() => {
    const isPrivySettled = ready && authenticated && walletsReady
    if (!isPrivySettled) return
    if (user === null) return

    const hasEmbeddedWallet = (user.linkedAccounts ?? []).some(
      (account) =>
        account.type === 'wallet' &&
        typeof account.walletClientType === 'string' &&
        EMBEDDED_WALLET_CLIENT_TYPES.includes(account.walletClientType),
    )
    const hasUsableWallet = user.wallet != null || hasEmbeddedWallet
    if (hasUsableWallet) return

    const alreadyAttemptedForUser = attemptedForUserRef.current === user.id
    if (alreadyAttemptedForUser) return
    attemptedForUserRef.current = user.id

    // createWallet() rejects on failure; the outcome is surfaced via the
    // useCreateWallet onError callback above, so the rejection is swallowed here
    // to avoid an unhandled-promise warning.
    void createWallet().catch(() => undefined)
  }, [ready, authenticated, walletsReady, user, createWallet])
}
