import { Share2 } from 'lucide-react'
import styles from './account-dock.module.css'
import { IconButton } from '@/modules/shared/components/icon-button'
import {
  formatHistoryTime,
  pnlSign,
  fillCrossingLabel,
  formatFillSize,
  formatTokenWithUnit,
  FILL_QUOTE_TOKEN,
} from './account-dock.utils'
import { parseHip3Symbol } from '@/modules/shared/utils/hip3-symbol'
import { buildIconMarketFromSymbol } from '@/modules/shared/utils/resolve-market-icon-url'
import { formatTokenAmount } from '@/modules/shared/utils/format-number'
import type { TradeHistoryRowProps } from './account-dock.types'
import { Badge } from '@/modules/shared/components/badge'
import { MarketKindTag } from '@/modules/shared/components/market-kind-tag'
import { AssetIcon } from '@/modules/shared/components/asset-icon'
import { FitCell } from '@/modules/shared/components/fit-cell'

export function TradeHistoryRow({ fill, onShare }: TradeHistoryRowProps) {
  const isBuy = fill.side === 'buy'
  // Side chip text is the venue direction ('Open Long'), falling back to the raw
  // side for venues that omit it; the buy/sell tone is kept either way.
  const sideLabel = fill.direction ?? fill.side
  const notionalUsd = fill.price * fill.size
  const feeToken = fill.feeToken ?? FILL_QUOTE_TOKEN
  const hasClosedPnl = fill.closedPnl !== undefined
  const closedPnlSign = pnlSign(fill.closedPnl ?? 0)
  // Strip the HIP-3 dex prefix from the asset cell ('xyz:NVDA' → 'NVDA') while
  // feeding the raw symbol to MarketKindTag (its classification keys on ':').
  const displaySymbol = parseHip3Symbol(fill.symbol).displaySymbol
  // Type cell is the maker/taker role from the crossing flag — 'Taker' (crossed),
  // 'Maker' (rested), or '--' when the venue omits the flag.
  const crossingLabel = fillCrossingLabel(fill.crossed)
  const canShare = hasClosedPnl && onShare !== undefined

  return (
    <div className={`${styles.row} ${styles.fillsRow}`}>
      <span className={styles.cell}>
        <FitCell align="left">{formatHistoryTime(fill.timestamp)}</FitCell>
      </span>
      <span className={styles.cell}>
        <span className={styles.symbolCell}>
          <AssetIcon market={buildIconMarketFromSymbol(fill.symbol)} size={18} />
          <FitCell align="left">{displaySymbol}</FitCell>
          <MarketKindTag symbol={fill.symbol} />
        </span>
      </span>
      <span className={styles.cell}>
        <Badge tone={isBuy ? 'directionUp' : 'directionDown'}>{sideLabel}</Badge>
      </span>
      <span className={styles.cell}>
        <FitCell>{formatTokenAmount(fill.price)}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{formatFillSize(fill.size, fill.symbol)}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{formatTokenWithUnit(notionalUsd, FILL_QUOTE_TOKEN)}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{formatTokenWithUnit(fill.fee, feeToken)}</FitCell>
      </span>
      <span className={styles.pnlCell} data-pnl-sign={hasClosedPnl ? closedPnlSign : 'zero'}>
        <FitCell>
          {hasClosedPnl
            ? formatTokenWithUnit(fill.closedPnl ?? 0, FILL_QUOTE_TOKEN, { signed: true })
            : '--'}
        </FitCell>
      </span>
      <span className={`${styles.cell} ${styles.actionsCell}`}>
        <span className={styles.rowActions}>
          <FitCell className={styles.fitCellFlex}>{crossingLabel}</FitCell>
          {canShare ? (
            <IconButton
              icon={Share2}
              elevated
              ariaLabel={`Share ${fill.symbol} PnL`}
              title={`Share ${fill.symbol} PnL`}
              onClick={onShare}
            />
          ) : null}
        </span>
      </span>
    </div>
  )
}
