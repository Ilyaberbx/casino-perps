import { useMemo } from 'react'
import { OrderIntentContext } from '../order-intent-provider.context'
import type { OrderIntent } from '../../../trading.types'
import type { OrderIntentContextValue } from '../order-intent-provider.types'

/**
 * A static order-intent provider for tests: seeds a fixed `pending` intent (or
 * `null`) so a consumer hook can assert it applies (or ignores) the prefill,
 * with a no-op `publish`. Use the real `OrderIntentProvider` when a test needs
 * `publish` to mutate `pending`.
 */
export function FakeOrderIntentProvider({
  pending,
  children,
}: {
  pending: OrderIntent | null
  children?: React.ReactNode
}) {
  const value = useMemo<OrderIntentContextValue>(
    () => ({ pending, publish: () => {} }),
    [pending],
  )
  return <OrderIntentContext.Provider value={value}>{children}</OrderIntentContext.Provider>
}
