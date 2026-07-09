import type {
  AccountActivityDelta,
  AccountActivityEntry,
  AccountActivityReader,
  WalletAddress,
} from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { HyperliquidGateway } from '../gateway/hyperliquid-gateway.types'
import type { UserNonFundingLedgerUpdatesResponse } from '../gateway/sdk-types'
import { createPagedHistoryReader } from './paged-history-reader'

/**
 * Static-only assertion: our domain `AccountActivityDelta` and the SDK's
 * per-record `delta` shape from `UserNonFundingLedgerUpdatesResponse` must be
 * the same discriminated union. If the SDK adds, removes, or renames a delta
 * kind, one of these two assignments stops type-checking and the build
 * breaks before the renderer's exhaustive `never`-narrowed default branch
 * can silently encounter an unknown kind.
 */
type _SdkDelta = UserNonFundingLedgerUpdatesResponse[number]['delta']
type _SdkVariantsNotInDomain = Exclude<_SdkDelta, AccountActivityDelta>
type _DomainVariantsNotInSdk = Exclude<AccountActivityDelta, _SdkDelta>
const _NO_SDK_VARIANT_DROPPED: [_SdkVariantsNotInDomain] extends [never] ? true : never = true
const _NO_DOMAIN_VARIANT_FABRICATED: [_DomainVariantsNotInSdk] extends [never] ? true : never = true
void _NO_SDK_VARIANT_DROPPED
void _NO_DOMAIN_VARIANT_FABRICATED

export function createHyperliquidAccountActivityReader(
  gateway: HyperliquidGateway,
  getAddress: () => WalletAddress | null,
  logger: Logger,
): AccountActivityReader {
  return createPagedHistoryReader<AccountActivityEntry, UserNonFundingLedgerUpdatesResponse>({
    getAddress,
    logger,
    logModule: 'hyperliquid-account-activity-reader',
    // The ledger endpoint returns oldest-first and ignores `reversed`, so we
    // forward-page the full history and sort newest-first in the reader (ADR-0034).
    order: 'ascending',
    fetch: (address, window) => gateway.getUserNonFundingLedgerUpdates(address, window),
    project: projectAccountActivityEntries,
    getTime: (entry) => entry.time,
    getKey: (entry) => `${entry.time}-${entry.hash}`,
  })
}

export function projectAccountActivityEntries(
  response: UserNonFundingLedgerUpdatesResponse,
): ReadonlyArray<AccountActivityEntry> {
  const out: AccountActivityEntry[] = []
  for (const record of response) {
    out.push({
      time: record.time,
      hash: record.hash,
      delta: record.delta,
    })
  }
  return out
}
