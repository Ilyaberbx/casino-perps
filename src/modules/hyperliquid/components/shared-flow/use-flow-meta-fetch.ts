import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ResultAsync } from 'neverthrow'
import type { Logger } from '@/modules/shared/logger'
import type { HyperliquidGatewayError } from '../../gateway/hyperliquid-gateway.types'
import type {
  SpotMetaAndAssetCtxsResponse,
  SpotMetaResponse,
} from '../../gateway/sdk-types'
import type { FlowMetaStatus } from './shared-flow.types'

/**
 * The narrowed read-gateway seam the meta fetch consumes — only
 * `getSpotMetaAndAssetCtxs`. A view of the read gateway so the projection runs
 * against `result.value[0]` (the spot meta) without coupling the hook to the
 * full gateway surface.
 */
export interface FlowMetaGateway {
  getSpotMetaAndAssetCtxs(): ResultAsync<SpotMetaAndAssetCtxsResponse, HyperliquidGatewayError>
}

/**
 * Inputs to the shared spot-meta fetch. `project` is the only per-flow
 * difference (`buildSpotSendTokenIndex` vs `buildEvmCoreTokenIndex`); `logModule`
 * preserves each provider's distinct warn-log module name.
 */
export interface UseFlowMetaFetchInput<TIndex> {
  readonly readGateway: FlowMetaGateway
  /** Projects the resolved spot meta into the flow's token index. */
  readonly project: (meta: SpotMetaResponse) => TIndex
  /** The token index rendered before the fetch resolves (per-flow empty map). */
  readonly emptyIndex: TIndex
  /** The logger module tag for the warn-on-error line (per-flow distinct). */
  readonly logModule: string
  readonly logger: Logger
}

export interface UseFlowMetaFetchReturn<TIndex> {
  readonly tokenIndex: TIndex
  readonly metaStatus: FlowMetaStatus
  readonly retryAssets: () => void
}

/**
 * Resolve the flow's spot-token index once from the spot meta, surfacing the
 * fetch status (not swallowing it) so the picker can show a loading / error+retry
 * state instead of a bare dropdown. Shared by the send / evm-core providers so a
 * bug is fixed once. `retryAssets` bumps an internal nonce to re-run the fetch.
 *
 * The `loading` setState is deferred a microtask so it does not land
 * synchronously inside the effect body (`react-hooks/set-state-in-effect`) —
 * mirrors the deposit / evm preflight effects; preserve the deferral exactly.
 */
export function useFlowMetaFetch<TIndex>(
  input: UseFlowMetaFetchInput<TIndex>,
): UseFlowMetaFetchReturn<TIndex> {
  const { readGateway, project, emptyIndex, logModule, logger } = input

  const [tokenIndex, setTokenIndex] = useState<TIndex>(emptyIndex)
  const [metaStatus, setMetaStatus] = useState<FlowMetaStatus>('loading')
  const [metaRefreshNonce, setMetaRefreshNonce] = useState(0)
  const retryAssets = useCallback(() => setMetaRefreshNonce((n) => n + 1), [])
  const metaLog = useMemo(() => logger.child({ module: logModule }), [logger, logModule])

  useEffect(() => {
    let cancelled = false
    // Defer the `loading` setState a microtask so it doesn't land synchronously
    // inside the effect body (react-hooks/set-state-in-effect) — mirrors the
    // deposit / evm preflight effects.
    void Promise.resolve().then(async () => {
      if (cancelled) return
      setMetaStatus('loading')
      const result = await readGateway.getSpotMetaAndAssetCtxs()
      if (cancelled) return
      if (result.isErr()) {
        metaLog.warn({ kind: result.error.kind }, 'spot meta fetch failed')
        setMetaStatus('error')
        return
      }
      setTokenIndex(project(result.value[0]))
      setMetaStatus('ready')
    })
    return () => {
      cancelled = true
    }
    // project/emptyIndex are stable per provider; re-run only on gateway / nonce
    // to preserve the original `[readGateway, metaRefreshNonce]` dep semantics.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readGateway, metaRefreshNonce, metaLog])

  return { tokenIndex, metaStatus, retryAssets }
}
