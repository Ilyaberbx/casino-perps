import type {
  FundingHistoryEntry,
  FundingHistoryReader,
  WalletAddress,
} from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { HyperliquidGateway } from '../gateway/hyperliquid-gateway.types'
import type { UserFundingResponse } from '../gateway/sdk-types'
import { parseStringifiedNumber } from '../hyperliquid.utils'
import { createPagedHistoryReader } from './paged-history-reader'

export { mapGatewayHistoryError as mapGatewayError } from './map-gateway-history-error'

export function createHyperliquidFundingHistoryReader(
  gateway: HyperliquidGateway,
  getAddress: () => WalletAddress | null,
  logger: Logger,
): FundingHistoryReader {
  return createPagedHistoryReader<FundingHistoryEntry, UserFundingResponse>({
    getAddress,
    logger,
    logModule: 'hyperliquid-funding-history-reader',
    // userFunding returns oldest-first; forward-page full history, sort newest-first.
    order: 'ascending',
    fetch: (address, window) => gateway.getUserFunding(address, window),
    project: projectFundingHistory,
    getTime: (entry) => entry.timestamp,
    getKey: (entry) => `${entry.timestamp}-${entry.symbol}`,
  })
}

export function projectFundingHistory(
  response: UserFundingResponse,
): ReadonlyArray<FundingHistoryEntry> {
  const out: FundingHistoryEntry[] = []
  for (const row of response) {
    out.push({
      symbol: row.delta.coin,
      amountUsd: parseStringifiedNumber(row.delta.usdc),
      fundingRate: parseStringifiedNumber(row.delta.fundingRate),
      positionSize: parseStringifiedNumber(row.delta.szi),
      timestamp: row.time,
    })
  }
  return out
}
