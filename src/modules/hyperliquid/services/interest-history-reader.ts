import type {
  InterestHistoryEntry,
  InterestHistoryReader,
  WalletAddress,
} from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { HyperliquidGateway } from '../gateway/hyperliquid-gateway.types'
import type { UserBorrowLendInterestResponse } from '../gateway/sdk-types'
import { parseStringifiedNumber } from '../hyperliquid.utils'
import { createPagedHistoryReader } from './paged-history-reader'

export function createHyperliquidInterestHistoryReader(
  gateway: HyperliquidGateway,
  getAddress: () => WalletAddress | null,
  logger: Logger,
): InterestHistoryReader {
  return createPagedHistoryReader<InterestHistoryEntry, UserBorrowLendInterestResponse>({
    getAddress,
    logger,
    logModule: 'hyperliquid-interest-history-reader',
    // userBorrowLendInterest returns oldest-first; forward-page, sort newest-first.
    order: 'ascending',
    fetch: (address, window) => gateway.getUserBorrowLendInterest(address, window),
    project: projectInterestEntries,
    getTime: (entry) => entry.timestamp,
    getKey: (entry) => `${entry.timestamp}-${entry.asset}`,
  })
}

export function projectInterestEntries(
  response: UserBorrowLendInterestResponse,
): ReadonlyArray<InterestHistoryEntry> {
  const out: InterestHistoryEntry[] = []
  for (const record of response) {
    const supply = parseStringifiedNumber(record.supply)
    const borrow = parseStringifiedNumber(record.borrow)
    out.push({
      asset: record.token,
      amountUsd: supply - borrow,
      timestamp: record.time,
    })
  }
  return out
}
