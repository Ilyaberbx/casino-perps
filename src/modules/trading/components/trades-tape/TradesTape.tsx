import { useTrades } from './use-trades'
import { TradeRow } from './TradeRow'
import { RowsSkeleton } from '../rows-skeleton/RowsSkeleton'
import { EmptyState } from '../../../shared/components/empty-state'
import styles from './trades-tape.module.css'
import { gridVariant, headerClass, tradesHaveParticipants } from './trades-tape.utils'
import { useSelectedMarketContext } from '../../providers/selected-market-provider'
import { useVenue } from '../../../shared/providers/venue-provider'
import { specFromMarket } from '@/modules/shared/utils/format-price'
import { SUBSCRIPTION_KEY_NONE } from '../../trading.constants'
import { NO_TRADES_MESSAGE, TRADES_SKELETON_ROWS } from './trades-tape.constants'
import type { TradesTapeProps } from './trades-tape.types'

export function TradesTape({ sizeAsset, baseSymbol, quoteSymbol, compact = false, isActive = true }: TradesTapeProps) {
  const { market } = useSelectedMarketContext()
  const venue = useVenue()
  const { trades, isLoading, hoveredAddress, hoverAddress, leaveAddress, spectateAddress } = useTrades(
    market.hlCoin ?? SUBSCRIPTION_KEY_NONE,
  )

  // Inactive tab: keep the hook above mounted+subscribed (trades keep
  // accumulating) but render no row subtree, so nothing reconciles per animation
  // frame while the tape is hidden. Must sit AFTER the hook so the stream stays warm.
  if (!isActive) return null

  // Hold the skeleton until the trades snapshot lands, so the tape flips once
  // from loading to populated instead of building up row-by-row. See ADR-0030.
  if (isLoading) {
    return <RowsSkeleton rows={TRADES_SKELETON_ROWS} />
  }

  const hasNoTrades = trades.length === 0
  const priceSpec = specFromMarket(market)
  // Compact mode drops both advanced columns: no explorer link, no participants.
  const explorerTxUrl = compact ? undefined : venue.metadata.explorerTxUrl
  const sizeUnit = sizeAsset === 'quote' ? quoteSymbol : baseSymbol
  const hasExplorer = explorerTxUrl !== undefined
  const showParticipants = compact ? false : tradesHaveParticipants(trades)
  const variant = gridVariant(showParticipants, hasExplorer)

  return (
    <div className={styles.container}>
      <div className={headerClass(variant, styles)}>
        <span className={styles.headerCell}>Time</span>
        <span className={styles.headerCell}>Price</span>
        <span className={styles.headerCell}>{sizeUnit}</span>
        {showParticipants ? <span className={styles.headerCellCentered}>T</span> : null}
        {showParticipants ? <span className={styles.headerCellCentered}>M</span> : null}
        {hasExplorer ? <span className={styles.headerCellCentered}>TX</span> : null}
      </div>
      {hasNoTrades ? (
        <EmptyState message={NO_TRADES_MESSAGE} />
      ) : (
        <div className={styles.list}>
          {trades.map((trade) => (
            <TradeRow
              key={trade.identifier}
              trade={trade}
              priceSpec={priceSpec}
              sizeAsset={sizeAsset}
              showParticipants={showParticipants}
              hoveredAddress={hoveredAddress}
              onHoverAddress={hoverAddress}
              onLeaveAddress={leaveAddress}
              onSpectateAddress={spectateAddress}
              explorerTxUrl={explorerTxUrl}
            />
          ))}
        </div>
      )}
    </div>
  )
}
