import type { BalanceSource } from '@/modules/shared/domain'
import type { TransferPrefill } from '@/modules/shared/providers/transfer-sheet-provider'

/**
 * Maps a balance row's source to the transfer-sheet prefill (slice 05): a
 * `spot` row pre-sets From Spot (Spot→Perp), a `perps` row pre-sets From Perp
 * (Perp→Spot). Any other source (`aggregated` — no single clear account)
 * returns `undefined`, opening the sheet with its default direction.
 */
export function transferPrefillForSource(source: BalanceSource): TransferPrefill | undefined {
  if (source === 'spot') return { from: 'spot' }
  if (source === 'perps') return { from: 'perps' }
  return undefined
}

export function balanceSourceLabel(source: BalanceSource): string {
  if (source === 'spot') return 'Spot'
  if (source === 'perps') return 'Perps'
  if (source === 'unified') return 'Unified'
  return 'All'
}
