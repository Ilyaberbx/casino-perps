import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import type { ActiveTwap, TwapController } from '@/modules/shared/domain'
import { CancelTwapError } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type {
  HyperliquidExchangeGateway,
  HyperliquidGatewayError,
  HyperliquidTwapCancelStatus,
  TwapCancelSuccessResponse,
} from '../gateway'
import type { HyperliquidAssetInfo } from './hyperliquid-trader.types'

export interface HyperliquidTwapControllerDeps {
  readonly exchangeGateway: HyperliquidExchangeGateway
  readonly getAgentWallet: () => Parameters<HyperliquidExchangeGateway['cancelTwap']>[0] | null
  readonly resolveAsset: (symbol: string) => HyperliquidAssetInfo | null
  readonly logger: Logger
}

/**
 * Hyperliquid `twapController` (ADR-0052): cancels running TWAP orders via the
 * exchange gateway's `twapCancel` action (`{ a, t }`). `a` is resolved from the
 * TWAP's market symbol via the asset resolver; `t = Number(twap.identifier)`
 * (the `twapId` projected onto the active-twap snapshot row). Agent-signed like
 * every trade (no master-wallet prompt). Missing signer / asset yield typed
 * errors (never a throw). A `status:"ok"` envelope can still carry an
 * `{ error }` in `data.status`; that surfaces as a `rejected` error. Not in the
 * SDK lint zone — it talks to the exchange gateway interface only.
 */
export function createHyperliquidTwapController(
  deps: HyperliquidTwapControllerDeps,
): TwapController {
  const log = deps.logger.child({ module: 'hyperliquid-twap-controller' })

  function cancelTwap(twap: ActiveTwap): ResultAsync<void, CancelTwapError> {
    const asset = deps.resolveAsset(twap.symbol)
    if (asset === null) {
      return errAsync(new CancelTwapError('unknown-symbol', `unknown symbol ${twap.symbol}`))
    }
    const agentWallet = deps.getAgentWallet()
    if (agentWallet === null) {
      return errAsync(new CancelTwapError('rejected', 'no approved agent wallet for signing'))
    }
    const twapId = Number(twap.identifier)
    log.debug({ symbol: twap.symbol }, 'cancel twap')
    return deps.exchangeGateway
      .cancelTwap(agentWallet, { a: asset.assetId, t: twapId })
      .mapErr((error: HyperliquidGatewayError) => new CancelTwapError('rejected', error.message))
      .andThen(unpackCancelResponse)
  }

  function cancelAll(
    twaps: ReadonlyArray<ActiveTwap>,
  ): ResultAsync<ReadonlyArray<CancelTwapError>, never> {
    // Issue each cancel and collect failures without short-circuiting (ADR-0052
    // D-3) — one rejected TWAP must not strand the others.
    const attempts = twaps.map((twap) =>
      cancelTwap(twap).match<CancelTwapError | null>(
        () => null,
        (error) => error,
      ),
    )
    return ResultAsync.fromSafePromise(
      Promise.all(attempts).then((results) =>
        results.filter((error): error is CancelTwapError => error !== null),
      ),
    )
  }

  return { cancelTwap, cancelAll }
}

/** Unpack the raw `twapCancel` success envelope: a `status:"ok"` response can
 *  still carry a per-cancel `{ error }` at runtime (ADR-0052). */
function unpackCancelResponse(
  response: TwapCancelSuccessResponse,
): ResultAsync<void, CancelTwapError> {
  // The SDK's success type strips `{ error }` from `data.status`; widen to the
  // raw union to reach the rejected branch (mirrors the trader's twap unpack).
  const status = response.response.data.status as HyperliquidTwapCancelStatus
  const isError = typeof status === 'object' && status !== null && 'error' in status
  if (isError) {
    return errAsync(new CancelTwapError('rejected', status.error))
  }
  return okAsync(undefined)
}
