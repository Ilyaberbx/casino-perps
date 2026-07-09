import type { Logger } from '@/modules/shared/logger'
import type { HyperliquidNetwork } from '../hyperliquid.types'

/** A single cached value with its absolute expiry (ms since epoch). */
export interface GatewayCacheEntry<T> {
  readonly value: T
  readonly expiresAt: number
}

/**
 * The persistence layer behind `withGatewayCache`. A `localStorage`-backed
 * implementation ships in `gateway-cache-store.ts`; tests inject an in-memory
 * fake. Every method must degrade to a miss / no-op on IO failure — never throw.
 */
export interface GatewayCacheStore {
  read<T>(key: string): T | null
  write<T>(key: string, value: T, ttlMs: number): void
}

export interface WithGatewayCacheOptions {
  readonly network: HyperliquidNetwork
  readonly logger: Logger
  /** Injected in tests; defaults to a `localStorage`-backed store. */
  readonly store?: GatewayCacheStore
}
