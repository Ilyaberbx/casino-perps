import { createContext } from 'react'
import type { OrderIntentContextValue } from './order-intent-provider.types'

export const OrderIntentContext = createContext<OrderIntentContextValue | null>(null)
