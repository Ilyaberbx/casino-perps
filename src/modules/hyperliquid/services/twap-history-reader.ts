import { okAsync, type ResultAsync } from 'neverthrow'
import type {
  PortfolioHistoryFetchError,
  TwapHistoryEntry,
  TwapHistoryReader,
  TwapHistoryStatus,
  Unsubscribe,
  WalletAddress,
} from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type {
  HyperliquidGateway,
  HyperliquidGatewayError,
} from '../gateway/hyperliquid-gateway.types'
import type { TwapHistoryResponse } from '../gateway/sdk-types'
import { parseStringifiedNumber } from '../hyperliquid.utils'

export function createHyperliquidTwapHistoryReader(
  gateway: HyperliquidGateway,
  getAddress: () => WalletAddress | null,
  logger: Logger,
): TwapHistoryReader {
  const log = logger.child({ module: 'hyperliquid-twap-history-reader' })
  log.debug({}, 'init')

  const listeners = new Set<(entries: ReadonlyArray<TwapHistoryEntry>) => void>()
  let entries: ReadonlyArray<TwapHistoryEntry> = []
  let scopedAddress: WalletAddress | null = null
  let fetched = false

  function notify(): void {
    for (const l of listeners) l(entries)
  }

  function rescope(nextAddress: WalletAddress | null): void {
    if (nextAddress === scopedAddress) return
    scopedAddress = nextAddress
    fetched = false
    if (entries.length > 0) {
      entries = []
      notify()
    }
  }

  return {
    subscribe(onUpdate): Unsubscribe {
      listeners.add(onUpdate)
      onUpdate(entries)
      return () => {
        listeners.delete(onUpdate)
      }
    },
    loadOlder(): ResultAsync<{ exhausted: boolean }, PortfolioHistoryFetchError> {
      const address = getAddress()
      rescope(address)
      if (address === null) {
        return okAsync({ exhausted: true })
      }
      if (fetched) {
        return okAsync({ exhausted: true })
      }
      fetched = true
      const requestedAddress = address
      return gateway
        .getTwapHistory(address)
        .map((response) => {
          if (getAddress() !== requestedAddress || scopedAddress !== requestedAddress) {
            return { exhausted: true }
          }
          const projected = projectTwapHistory(response)
          entries = projected
          log.debug({ count: projected.length }, 'projection')
          notify()
          return { exhausted: true }
        })
        .mapErr((gatewayError) => {
          const mapped = mapGatewayError(gatewayError)
          log.warn(
            { kind: mapped.kind, errorMessage: gatewayError.message },
            'twap history fetch failed',
          )
          return mapped
        })
    },
  }
}

export function mapGatewayError(
  error: HyperliquidGatewayError,
): PortfolioHistoryFetchError {
  switch (error.kind) {
    case 'network':
      return { kind: 'network' }
    case 'rate-limited':
      return { kind: 'rate-limited' }
    case 'invalid-response':
    case 'unknown-address':
    case 'wallet-rejected':
    case 'chain-mismatch':
    case 'builder-not-funded':
    case 'deposit-required':
    case 'approval-cap-reached':
    case 'agent-cap-reached':
    case 'name-collision':
    case 'agent-address-reused':
      // Exchange-side kinds (#166, #07-01 deposit-required, ADR-0077 agent-address-reused)
      // cannot occur on read-only history endpoints; collapse to `unknown` to keep the
      // switch exhaustive.
      return { kind: 'unknown', message: error.message }
  }
}

function projectTwapHistory(
  response: TwapHistoryResponse,
): ReadonlyArray<TwapHistoryEntry> {
  const out: TwapHistoryEntry[] = []
  for (const record of response) {
    const status = record.status.status as TwapHistoryStatus
    const isStillActive = status === 'activated'
    out.push({
      identifier:
        record.twapId !== undefined
          ? String(record.twapId)
          : `${record.state.timestamp}-${record.state.coin}`,
      symbol: record.state.coin,
      side: record.state.side === 'B' ? 'buy' : 'sell',
      size: parseStringifiedNumber(record.state.sz),
      executedSize: parseStringifiedNumber(record.state.executedSz),
      executedNotionalUsd: parseStringifiedNumber(record.state.executedNtl),
      status,
      createdAt: record.state.timestamp,
      endedAt: isStillActive ? null : record.time * 1000,
      durationMinutes: record.state.minutes,
      reduceOnly: record.state.reduceOnly,
      randomize: record.state.randomize,
    })
  }
  return out
}
