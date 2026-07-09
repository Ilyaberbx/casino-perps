import { useContext } from 'react'
import { OrderIntentContext } from './order-intent-provider.context'
import type { OrderIntentContextValue } from './order-intent-provider.types'

export function useOrderIntent(): OrderIntentContextValue {
  const ctx = useContext(OrderIntentContext)
  if (!ctx) {
    throw new Error('useOrderIntent must be used inside <OrderIntentProvider>')
  }
  return ctx
}
