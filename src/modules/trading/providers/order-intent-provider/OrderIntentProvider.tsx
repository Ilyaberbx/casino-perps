import { useCallback, useMemo, useState } from 'react'
import { OrderIntentContext } from './order-intent-provider.context'
import type { OrderIntent } from '../../trading.types'
import type {
  OrderIntentContextValue,
  OrderIntentProviderProps,
} from './order-intent-provider.types'

/**
 * Holds the order-intent bus (issue #213) — the one-way channel from the
 * suggestion sheet to the order ticket. `pending` is reactive so a `publish`
 * re-renders the ticket, which applies each distinct intent once. Mounted in
 * `app/router.tsx` alongside `SelectedMarketProvider`, wrapping `TradingPage`
 * so both the sheet and the order ticket read the same instance.
 */
export function OrderIntentProvider({ children }: OrderIntentProviderProps) {
  const [pending, setPending] = useState<OrderIntent | null>(null)
  const publish = useCallback((intent: OrderIntent) => setPending(intent), [])
  const value = useMemo<OrderIntentContextValue>(
    () => ({ pending, publish }),
    [pending, publish],
  )
  return <OrderIntentContext.Provider value={value}>{children}</OrderIntentContext.Provider>
}
