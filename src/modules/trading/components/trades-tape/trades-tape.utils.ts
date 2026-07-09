import type { Trade } from '../../../shared/domain/domain.types'
import type { GridVariant } from './trades-tape.types'
import { numberFormat } from '@/modules/shared/utils/intl-cache'

/**
 * The trades-tape grid extends `Time | Price | Size | T | M | TX`, where the
 * participant (T/M) and TX columns are each conditional. Both the header and
 * every row must share the same column template, so the variant is resolved
 * once from the two flags. The CSS class names mirror these four shapes.
 */
export function gridVariant(showParticipants: boolean, hasExplorer: boolean): GridVariant {
  if (showParticipants && hasExplorer) return 'withParticipantsTx'
  if (showParticipants) return 'withParticipants'
  if (hasExplorer) return 'withTx'
  return 'base'
}

/** Resolve the row grid class for a variant from the CSS-module styles record. */
export function rowClass(variant: GridVariant, styles: Record<string, string>): string {
  if (variant === 'withParticipantsTx') return styles.rowWithParticipantsTx
  if (variant === 'withParticipants') return styles.rowWithParticipants
  if (variant === 'withTx') return styles.rowWithTx
  return styles.row
}

/** Resolve the header grid class for a variant from the CSS-module styles record. */
export function headerClass(variant: GridVariant, styles: Record<string, string>): string {
  if (variant === 'withParticipantsTx') return styles.headerWithParticipantsTx
  if (variant === 'withParticipants') return styles.headerWithParticipants
  if (variant === 'withTx') return styles.headerWithTx
  return styles.header
}

/**
 * The Taker/Maker columns render only when the buffered trades actually carry
 * participant addresses (the mock venue and Hyperliquid populate them; a venue
 * that omits them must not get two empty columns). One participant present is
 * enough to show both columns.
 */
export function tradesHaveParticipants(trades: Trade[]): boolean {
  return trades.some((trade) => trade.takerAddress !== undefined || trade.makerAddress !== undefined)
}

export function formatSize(size: number): string {
  // Larger notionals (e.g. quote-denominated MON volumes ~10k) read better with
  // 0 decimals, sub-1 sizes need at least 4. Pick decimals from the magnitude.
  const decimals = size >= 1000 ? 0 : size >= 1 ? 2 : 4
  return numberFormat({
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(size)
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

export function formatIsoTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString()
}
