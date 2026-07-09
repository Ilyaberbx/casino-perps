import { okAsync, type ResultAsync } from 'neverthrow'
import { formatAddress } from '@/modules/shared/logger'
import type {
  HyperliquidGateway,
  HyperliquidGatewayError,
} from './hyperliquid-gateway.types'
import { GATEWAY_CACHE_TTL_MS } from './gateway-cache.constants'
import { createLocalStorageCacheStore } from './gateway-cache-store'
import type { WithGatewayCacheOptions } from './gateway-cache.types'

type CacheableMethod = keyof typeof GATEWAY_CACHE_TTL_MS

/**
 * Decorates a `HyperliquidGateway` with a two-layer cache over a fixed
 * allowlist of REST reads (see `GATEWAY_CACHE_TTL_MS`): a persistent
 * `localStorage` TTL store that survives reload, plus an in-memory in-flight
 * dedup map that coalesces concurrent identical reads (cold-reload fan-out,
 * React StrictMode double-mount). Errors are never cached; every other gateway
 * method passes through untouched. Does not import `@nktkas/hyperliquid`, so
 * the SDK lint zone (ADR-0009/0010) is unaffected. See ADR-0022.
 */
export function withGatewayCache(
  inner: HyperliquidGateway,
  options: WithGatewayCacheOptions,
): HyperliquidGateway {
  const log = options.logger.child({ module: 'hyperliquid-gateway-cache' })
  const store = options.store ?? createLocalStorageCacheStore()
  const inflight = new Map<string, ResultAsync<unknown, HyperliquidGatewayError>>()

  function cached<T>(
    method: CacheableMethod,
    argsKey: string,
    run: () => ResultAsync<T, HyperliquidGatewayError>,
  ): ResultAsync<T, HyperliquidGatewayError> {
    const key = `${options.network}:${method}:${argsKey}`
    const hit = store.read<T>(key)
    if (hit !== null) return okAsync(hit)
    const pending = inflight.get(key)
    // Safe: the key encodes method + args, so an in-flight entry under this key
    // was produced by this same `cached<T>` call shape and carries a `T` value.
    if (pending !== undefined) return pending as ResultAsync<T, HyperliquidGatewayError>
    const run$ = run().map((value) => {
      store.write(key, value, GATEWAY_CACHE_TTL_MS[method])
      return value
    })
    inflight.set(key, run$)
    // Release on settle (ok OR err). Errors never reach `.map`, so they are
    // never written to the store — only the in-flight entry is cleared.
    void run$.then(() => inflight.delete(key))
    return run$
  }

  return {
    ...inner, // new / non-allowlisted gateway methods pass through uncached
    getMetaAndAssetCtxs: () =>
      cached('getMetaAndAssetCtxs', 'main', () => inner.getMetaAndAssetCtxs()),
    getSpotMetaAndAssetCtxs: () =>
      cached('getSpotMetaAndAssetCtxs', 'main', () => inner.getSpotMetaAndAssetCtxs()),
    getPerpDexs: () => cached('getPerpDexs', 'main', () => inner.getPerpDexs()),
    getPerpMetaAndAssetCtxs: (dex) =>
      cached('getPerpMetaAndAssetCtxs', dex, () => inner.getPerpMetaAndAssetCtxs(dex)),
    getUserFees: (address) =>
      cached('getUserFees', address, () => {
        // Redact the address in logs; the raw address lives only in the cache key.
        log.debug({ address: formatAddress(address) }, 'userFees cache miss')
        return inner.getUserFees(address)
      }),
  }
}
