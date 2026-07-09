import { useCallback, useEffect, useRef } from 'react'
import { useConnectWallet, useWallets } from '@privy-io/react-auth'

const CONNECT_WALLET_TIMEOUT_MS = 60_000

type Pending = {
  resolve: () => void
  reject: (cause: unknown) => void
  timer: ReturnType<typeof setTimeout> | null
}

type LoginOrLinkable = { address: string; loginOrLink: () => Promise<unknown> }

function isLoginOrLinkable(wallet: unknown): wallet is LoginOrLinkable {
  if (typeof wallet !== 'object' || wallet === null) return false
  const candidate = wallet as { address?: unknown; loginOrLink?: unknown }
  return typeof candidate.address === 'string' && typeof candidate.loginOrLink === 'function'
}

function clearPending(pending: Pending): void {
  if (pending.timer !== null) clearTimeout(pending.timer)
}

export function useExternalWalletLogin(): { loginWithWallet: () => Promise<void> } {
  const pendingRef = useRef<Pending | null>(null)
  const targetAddressRef = useRef<string | null>(null)
  const { wallets } = useWallets()

  const onSuccess = useCallback((params: { wallet: unknown }): void => {
    const wallet = params.wallet
    if (typeof wallet !== 'object' || wallet === null) return
    const address = (wallet as { address?: unknown }).address
    if (typeof address !== 'string') {
      const pending = pendingRef.current
      pendingRef.current = null
      if (pending) {
        clearPending(pending)
        pending.reject(new Error('Connected wallet has no address'))
      }
      return
    }
    targetAddressRef.current = address.toLowerCase()
  }, [])

  const onError = useCallback((cause: unknown) => {
    targetAddressRef.current = null
    const pending = pendingRef.current
    if (!pending) return
    pendingRef.current = null
    clearPending(pending)
    pending.reject(cause)
  }, [])

  const { connectWallet } = useConnectWallet({ onSuccess, onError })

  useEffect(() => {
    const target = targetAddressRef.current
    const hasPendingTarget = target !== null && pendingRef.current !== null
    if (!hasPendingTarget) return

    const match = wallets.find((wallet) => {
      if (!isLoginOrLinkable(wallet)) return false
      return wallet.address.toLowerCase() === target
    })
    if (!match || !isLoginOrLinkable(match)) return

    targetAddressRef.current = null
    const pending = pendingRef.current!
    void match
      .loginOrLink()
      .then(() => {
        pendingRef.current = null
        clearPending(pending)
        pending.resolve()
      })
      .catch((cause: unknown) => {
        pendingRef.current = null
        clearPending(pending)
        pending.reject(cause)
      })
  }, [wallets])

  const loginWithWallet = useCallback((): Promise<void> => {
    const alreadyConnected = wallets.find(isLoginOrLinkable)
    const hasExistingConnection = alreadyConnected !== undefined
    if (hasExistingConnection) {
      return alreadyConnected.loginOrLink().then(() => undefined)
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pendingRef.current === null) return
        pendingRef.current = null
        targetAddressRef.current = null
        const cause = new Error('connect-wallet timed out')
        cause.name = 'TimeoutError'
        reject(cause)
      }, CONNECT_WALLET_TIMEOUT_MS)
      pendingRef.current = { resolve, reject, timer }
      targetAddressRef.current = null
      connectWallet()
    })
  }, [wallets, connectWallet])

  return { loginWithWallet }
}
