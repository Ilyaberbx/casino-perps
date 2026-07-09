import { useCallback, useMemo, useState } from 'react'
import { useAuth } from '../auth-provider'
import { AccountModalContext } from './account-modal-provider.context'
import type {
  AccountModalContextValue,
  AccountModalProviderProps,
} from './account-modal-provider.types'

/**
 * Owns the `{ isOpen, open, close }` controller for the Account Modal
 * (PRD-0006 UI-2). The header avatar trigger calls `open()`; the `<AccountModal>`
 * reads `isOpen` / `close`. Both are mounted by `app/`'s composition root, so the
 * state lives in a provider unit rather than a single component's smart hook.
 */
export function AccountModalProvider({ children, defaultOpen = false }: AccountModalProviderProps) {
  const { authenticated } = useAuth()
  const [isOpenRequested, setIsOpenRequested] = useState(defaultOpen)
  const open = useCallback(() => setIsOpenRequested(true), [])
  const close = useCallback(() => setIsOpenRequested(false), [])

  // The Account Modal is auth-gated UI: the avatar trigger only renders while
  // authenticated, so on logout (or session loss) the modal must vanish rather
  // than linger, empty, over the disconnected shell. Derive visibility from
  // `authenticated` — same shape as the connect modal's `isModalRequested &&
  // !authenticated` in use-auth-value.ts — so an auth flip closes it without a
  // setState-in-effect.
  const isOpen = isOpenRequested && authenticated

  const value = useMemo<AccountModalContextValue>(
    () => ({ isOpen, open, close }),
    [isOpen, open, close],
  )
  return <AccountModalContext.Provider value={value}>{children}</AccountModalContext.Provider>
}
