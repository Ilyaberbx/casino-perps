import { useCallback, useMemo, useState } from 'react'
import { StatusCodes } from 'http-status-codes'
import { useAuth } from '../providers/auth-provider'
import { useOnboardingFlow } from './use-onboarding-flow'
import { selectWallet } from '../api/select-wallet'
import { importWallet } from '../api/import-wallet'
import { removeWallet } from '../api/remove-wallet'
import { toast } from '@/modules/shared/services/toast'
import { MAX_IMPORTED_WALLETS } from '../components/account-modal/account-modal.constants'
import type { HttpError } from '@/modules/shared/http'
import type { Wallet } from '../domain/types'
import type { WalletMutationsView } from './wallet-mutations.types'

/**
 * The single select/import/remove machinery over the user's wallets (PRD-0006
 * UI-5 / Workstream D). Every mutation returns the fresh `Me`, fed back into the
 * canonical onboarding-flow cache via `applyMe` — the single source of truth —
 * so `useSelectedWallet` and every consumer (the Account Modal Wallets section
 * **and** the header Quick-Wallet Switcher) stay in lock-step with the server
 * `is_selected`. Selection is **optimistic** for snappiness, then reconciled
 * from the server-returned `Me` (not discarded) so the badge and cache agree.
 */
export function useWalletMutations(): WalletMutationsView {
  const { apiClient, linkWallet } = useAuth()
  const flow = useOnboardingFlow()

  const applyMe = flow.kind === 'ready' ? flow.applyMe : undefined

  const serverWallets = useMemo<ReadonlyArray<Wallet>>(
    () => (flow.kind === 'ready' ? flow.me.wallets : []),
    [flow],
  )

  const [optimisticSelected, setOptimisticSelected] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const serverSelectedAddress = serverWallets.find((w) => w.isSelected)?.address ?? null
  const selectedAddress = optimisticSelected ?? serverSelectedAddress

  const importedCount = serverWallets.filter((w) => w.source === 'external').length
  const isImportAtCap = importedCount >= MAX_IMPORTED_WALLETS

  const onSelect = useCallback(
    (address: string) => {
      const previous = serverSelectedAddress
      setOptimisticSelected(address)
      void selectWallet(apiClient, address).match(
        (me) => {
          applyMe?.(me)
          setOptimisticSelected(null)
        },
        (error) => {
          setOptimisticSelected(previous)
          surfaceSelectError(error)
        },
      )
    },
    [apiClient, serverSelectedAddress, applyMe],
  )

  const onImport = useCallback(() => {
    if (isImportAtCap) return
    setIsImporting(true)
    void linkWallet()
      .mapErr(() => 'link-cancelled' as const)
      .andThen((address) => importWallet(apiClient, address))
      .match(
        (me) => {
          applyMe?.(me)
          setOptimisticSelected(null)
          setIsImporting(false)
          toast.show({
            variant: 'success',
            title: 'Wallet imported',
            description: 'Your wallet was added to your account.',
          })
        },
        (error) => {
          setIsImporting(false)
          if (error === 'link-cancelled') return
          surfaceImportError(error)
        },
      )
  }, [apiClient, linkWallet, isImportAtCap, applyMe])

  const onRemove = useCallback(
    (address: string) => {
      void removeWallet(apiClient, address).match(
        (me) => {
          applyMe?.(me)
          setOptimisticSelected(null)
          toast.show({
            variant: 'success',
            title: 'Wallet removed',
            description: 'The imported wallet was removed from your account.',
          })
        },
        (error) => surfaceRemoveError(error),
      )
    },
    [apiClient, applyMe],
  )

  return {
    selectedAddress,
    importedCount,
    isImportAtCap,
    importHint: `${importedCount}/${MAX_IMPORTED_WALLETS} imported`,
    isImporting,
    onSelect,
    onImport,
    onRemove,
  }
}

function surfaceSelectError(error: HttpError): void {
  const isForbidden = error.kind === 'api' && error.status === StatusCodes.FORBIDDEN
  const description = isForbidden
    ? 'That wallet belongs to a different account.'
    : 'Could not select that wallet. Please try again.'
  toast.show({ variant: 'error', title: 'Selection failed', description })
}

function surfaceImportError(error: HttpError): void {
  const isConflict = error.kind === 'api' && error.status === StatusCodes.CONFLICT
  const isForbidden = error.kind === 'api' && error.status === StatusCodes.FORBIDDEN
  const description = isConflict
    ? 'You have reached the import limit, or that wallet is already in use.'
    : isForbidden
      ? 'We could not verify ownership of that wallet.'
      : 'Could not import that wallet. Please try again.'
  toast.show({ variant: 'error', title: 'Import failed', description })
}

function surfaceRemoveError(error: HttpError): void {
  const isForbidden = error.kind === 'api' && error.status === StatusCodes.FORBIDDEN
  const description = isForbidden
    ? 'That wallet cannot be removed.'
    : 'Could not remove that wallet. Please try again.'
  toast.show({ variant: 'error', title: 'Remove failed', description })
}
