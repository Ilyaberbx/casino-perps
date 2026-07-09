import { useCallback, useMemo, useState } from 'react'
import { ManageFundsContext } from './manage-funds-provider.context'
import { DEFAULT_MANAGE_FUNDS_TAB } from './manage-funds.constants'
import type {
  ManageFundsContextValue,
  ManageFundsProviderProps,
  ManageFundsTab,
} from './manage-funds-provider.types'

/**
 * Owns the `{ isOpen, activeTab, open, close, setActiveTab }` controller for the
 * in-app Manage Funds modal. Venue-agnostic: this provider knows nothing about
 * which venue (if any) renders a deposit / transfer / withdraw body — that
 * resolution happens in the modal's smart hook. Structural mirror of
 * `deposit-sheet-provider`, with the added active-tab state so the header pills
 * can deep-link a specific tab.
 */
export function ManageFundsProvider({
  children,
  defaultOpen = false,
  defaultTab = DEFAULT_MANAGE_FUNDS_TAB,
}: ManageFundsProviderProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [activeTab, setActiveTab] = useState<ManageFundsTab>(defaultTab)

  const open = useCallback((tab: ManageFundsTab) => {
    setActiveTab(tab)
    setIsOpen(true)
  }, [])
  const close = useCallback(() => setIsOpen(false), [])

  const value = useMemo<ManageFundsContextValue>(
    () => ({ isOpen, activeTab, open, close, setActiveTab }),
    [isOpen, activeTab, open, close],
  )

  return (
    <ManageFundsContext.Provider value={value}>{children}</ManageFundsContext.Provider>
  )
}
