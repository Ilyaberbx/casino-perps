import { createContext } from 'react'
import type { Hip3AbstractionContextValue } from './venue-hip3-abstraction-provider.types'

const UNSET = Symbol('venue-hip3-abstraction-context-unset')

export type Hip3AbstractionContextSlot = Hip3AbstractionContextValue | typeof UNSET

export const HIP3_ABSTRACTION_UNSET = UNSET

export const VenueHip3AbstractionContext = createContext<Hip3AbstractionContextSlot>(UNSET)
