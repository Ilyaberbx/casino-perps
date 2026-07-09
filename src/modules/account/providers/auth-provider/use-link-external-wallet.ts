import { useCallback, useRef } from 'react'
import { useLinkAccount } from '@privy-io/react-auth'

const LINK_WALLET_TIMEOUT_MS = 60_000

type Pending = {
  resolve: (address: string) => void
  reject: (cause: unknown) => void
  timer: ReturnType<typeof setTimeout> | null
}

function clearPending(pending: Pending): void {
  if (pending.timer !== null) clearTimeout(pending.timer)
}

function readWalletAddress(linkedAccount: unknown): string | null {
  const isObject = typeof linkedAccount === 'object' && linkedAccount !== null
  if (!isObject) return null
  const candidate = linkedAccount as { type?: unknown; address?: unknown }
  const isWallet = candidate.type === 'wallet' && typeof candidate.address === 'string'
  return isWallet ? (candidate.address as string) : null
}

/**
 * Opens Privy's link-wallet modal and resolves with the linked **external**
 * wallet address (PRD-0006 Slice 06 import flow). The address is the
 * client-supplied half of the import — ownership is then proven server-side via
 * `verifyWalletOwnership` before the `external` wallet is persisted. Rejects on
 * a non-wallet link, a cancelled/failed link, or a timeout.
 */
export function useLinkExternalWallet(): { linkWallet: () => Promise<string> } {
  const pendingRef = useRef<Pending | null>(null)

  const onSuccess = useCallback((params: { linkedAccount: unknown }): void => {
    const pending = pendingRef.current
    if (!pending) return
    pendingRef.current = null
    clearPending(pending)
    const address = readWalletAddress(params.linkedAccount)
    if (address === null) {
      pending.reject(new Error('Linked account is not a wallet'))
      return
    }
    pending.resolve(address)
  }, [])

  const onError = useCallback((cause: unknown) => {
    const pending = pendingRef.current
    if (!pending) return
    pendingRef.current = null
    clearPending(pending)
    pending.reject(cause)
  }, [])

  const { linkWallet: privyLinkWallet } = useLinkAccount({ onSuccess, onError })

  const linkWallet = useCallback((): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pendingRef.current === null) return
        pendingRef.current = null
        const cause = new Error('link-wallet timed out')
        cause.name = 'TimeoutError'
        reject(cause)
      }, LINK_WALLET_TIMEOUT_MS)
      pendingRef.current = { resolve, reject, timer }
      privyLinkWallet()
    })
  }, [privyLinkWallet])

  return { linkWallet }
}
