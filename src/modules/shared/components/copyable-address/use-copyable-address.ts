import { useCallback } from 'react'
import { ResultAsync } from 'neverthrow'
import { formatWalletAddress } from '@/modules/shared/utils/format-wallet-address'
import { toast } from '@/modules/shared/services/toast'
import type { ClipboardError } from './copyable-address.types'

interface UseCopyableAddressResult {
  readonly truncated: string
  readonly handleCopy: () => void
}

/**
 * Smart hook for `CopyableAddress`: derives the truncated display form and owns
 * the copy-to-clipboard action. `navigator.clipboard.writeText` can reject, so
 * it is wrapped at the boundary (error-handling.md — no try/catch in feature
 * code); on success it fires the shared toast service ("Address copied").
 */
export function useCopyableAddress(address: string): UseCopyableAddressResult {
  const truncated = formatWalletAddress(address)

  const handleCopy = useCallback(() => {
    ResultAsync.fromPromise(
      navigator.clipboard.writeText(address),
      (cause): ClipboardError => ({ kind: 'copy-failed', cause }),
    ).match(
      () => {
        toast.show({ variant: 'success', title: 'Address copied' })
      },
      () => {
        toast.show({ variant: 'error', title: 'Could not copy address' })
      },
    )
  }, [address])

  return { truncated, handleCopy }
}
