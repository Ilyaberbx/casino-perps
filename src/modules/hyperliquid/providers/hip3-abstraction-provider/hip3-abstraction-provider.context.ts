import { createContext } from 'react'
import type { Hip3AbstractionState } from '@/modules/shared/domain'

// Context is private to the provider unit — not exported from index.ts.
// The venue-agnostic `Hip3AbstractionState` (status + enable) is the value.
export const Hip3AbstractionContext = createContext<Hip3AbstractionState | null>(null)
