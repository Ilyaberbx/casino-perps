import styles from './account-dock.module.css'
import {
  formatHistoryTime,
  pnlSign,
  formatFillSize,
  formatTokenWithUnit,
  FILL_QUOTE_TOKEN,
} from './account-dock.utils'
import { parseHip3Symbol } from '@/modules/shared/utils/hip3-symbol'
import { formatTokenAmount } from '@/modules/shared/utils/format-number'
import { buildIconMarketFromSymbol } from '@/modules/shared/utils/resolve-market-icon-url'
import { Badge } from '@/modules/shared/components/badge'
import { MarketKindTag } from '@/modules/shared/components/market-kind-tag'
import type { TwapFillHistoryRowProps } from './twap-panel.types'
import { AssetIcon } from '@/modules/shared/components/asset-icon'
import { FitCell } from '@/modules/shared/components/fit-cell'

/**
 * One per-slice TWAP fill (Fill History sub-tab). Same column vocabulary as the
 * Trade History row minus the Type/Share affordances: Time, Asset, Side, Price,
 * Size, Trade Value, Fee, Closed PNL. Trade Value is computed at render
 * (`price × size`, ADR-0023), never stored.
 */
export function TwapFillHistoryRow({ fill }: TwapFillHistoryRowProps) {
  const isBuy = fill.side === 'buy'
  const sideLabel = fill.direction ?? fill.side
  const notionalUsd = fill.price * fill.size
  const feeToken = fill.feeToken ?? FILL_QUOTE_TOKEN
  const hasClosedPnl = fill.closedPnl !== undefined
  const closedPnlSign = pnlSign(fill.closedPnl ?? 0)
  const displaySymbol = parseHip3Symbol(fill.symbol).displaySymbol

  return (
    <div className={`${styles.row} ${styles.twapFillRow}`}>
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
    </div>
  )
}
