import { Pencil, Share2, SlidersHorizontal, X } from 'lucide-react'
import styles from './account-dock.module.css'
import {
  pnlSign,
  isActivationKey,
  marginModeLabel,
  formatTpslCell,
} from './account-dock.utils'
import { formatPnlPct } from '@/modules/shared/utils/format-pnl'
import { formatUsd, formatTokenAmount } from '@/modules/shared/utils/format-number'
import { buildIconMarket } from '@/modules/shared/utils/resolve-market-icon-url'
import type { PositionRowProps } from './account-dock.types'
import { GatedActionButton } from './GatedActionButton'
import { IconButton } from '@/modules/shared/components/icon-button'
import { Badge } from '@/modules/shared/components/badge'
import { AssetIcon } from '@/modules/shared/components/asset-icon'
import { FitCell } from '@/modules/shared/components/fit-cell'

const CLOSE_DISABLED_TOOLTIP = 'Complete Hyperliquid setup to close positions'

export function PositionRow({
  position,
  displaySymbol,
  dexTag,
  isHip3,
  tpsl,
  onClose,
  onOpenManage,
  onEditTpsl,
  onShare,
  onSelect,
  hasTrader,
  hasPositionProtection,
  showActionsColumn,
}: PositionRowProps) {
  const isLong = position.side === 'long'
  const tpslText = formatTpslCell(tpsl)
  const pnlSignValue = pnlSign(position.unrealizedPnlUsd)
  const liqPrice =
    position.liquidationPrice === null ? '--' : formatTokenAmount(position.liquidationPrice)
  // Size shows the bare base-asset amount; the ticker lives in the cell `title`
  // only. The Asset column already names the ticker on the same row, so repeating
  // it here was redundant (Issue #253 follow-up). Hover / screen-reader still get
  // the full "89.175 XYZ100".
  const sizeAmount = formatTokenAmount(position.size)
  const sizeWithUnit = `${sizeAmount} ${displaySymbol}`
  const isSelectable = onSelect !== undefined
  // Drop the Actions track while spectating so the row matches the header's
  // one-fewer-column grid.
  const positionsGridClass = showActionsColumn ? styles.positionsRow : styles.positionsRowSpectate
  const rowClass = isSelectable
    ? `${styles.row} ${positionsGridClass} ${styles.rowSelectable}`
    : `${styles.row} ${positionsGridClass}`

  // The whole row loads the position's market on the chart, except the trailing
  // action columns (Actions / TP-SL) — those stop propagation so their buttons
  // act independently of row selection.
  return (
    <div
      className={rowClass}
      role={isSelectable ? 'button' : undefined}
      tabIndex={isSelectable ? 0 : undefined}
      aria-label={isSelectable ? `Show ${displaySymbol} chart` : undefined}
      onClick={onSelect}
      onKeyDown={
        isSelectable
          ? (event) => {
              if (!isActivationKey(event.key)) return
              event.preventDefault()
              onSelect()
            }
          : undefined
      }
    >
      <span className={styles.cell}>
        <span className={styles.symbolCell}>
          <AssetIcon market={buildIconMarket(displaySymbol, isHip3 ? 'hip3' : 'perp')} size={18} />
          <FitCell align="left">{displaySymbol}</FitCell>
          {isHip3 ? <Badge tone="neutral">{dexTag}</Badge> : null}
          <Badge tone={isLong ? 'directionUp' : 'directionDown'}>
            {isLong ? 'Long' : 'Short'} {position.leverage}x
          </Badge>
        </span>
      </span>
      <span
        className={`${styles.cell} ${styles.directionAmount}`}
        data-direction={isLong ? 'long' : 'short'}
      >
        <FitCell title={sizeWithUnit}>{sizeAmount}</FitCell>
      </span>
      {/* USD notional — `$`-prefixed like the Margin column and the TP/SL dialog
          (`PositionTpslInfoRows`), not a ` USDC` token suffix. The suffix was
          redundant (the value is always USD) and, on whale notionals, overflowed
          past FitCell's 0.5 floor and clipped to "…207 US". See Issue #253. */}
      <span className={styles.cell}>
        <FitCell>{formatUsd(position.positionValueUsd)}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{formatTokenAmount(position.entryPrice)}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{formatTokenAmount(position.markPrice)}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{liqPrice}</FitCell>
      </span>
      <span className={`${styles.pnlCell} ${styles.pnlCellWithShare}`} data-pnl-sign={pnlSignValue}>
        <FitCell className={styles.fitCellFlex}>
          {formatUsd(position.unrealizedPnlUsd, { signed: true })} ({formatPnlPct(position.roePct)})
        </FitCell>
        {/* Share is read-only and capability-free, but hidden while spectating
            (`onShare` omitted) — you may only share your own PnL. Sits beside the
            PNL value (matching trade.xyz); stops propagation so it doesn't also
            trigger the row's load-chart select. */}
        {onShare !== undefined ? (
          <IconButton
            icon={Share2}
            tone="ghost"
            ariaLabel={`Share ${displaySymbol} PnL`}
            title={`Share ${displaySymbol} PnL`}
            onClick={(event) => {
              event.stopPropagation()
              onShare()
            }}
          />
        ) : null}
      </span>
      <span className={styles.cell}>
        <FitCell>
          {formatUsd(position.marginUsedUsd)}{' '}
          <span className={styles.marginMode}>({marginModeLabel(position.leverageType)})</span>
        </FitCell>
      </span>
      {/* Funding / TP-SL still stubbed — no backing capability yet (HL `trader`
          deferred, no funding feed) per ADR-0023. The Actions column now hosts
          a venue-gated Close button when `trader` is exposed (Slice 8/12 of
          `.design/hyperliquid-onboarding`). */}
      <span className={styles.cell}>
        <FitCell>--</FitCell>
      </span>
      {showActionsColumn ? (
        <span
          className={`${styles.cell} ${styles.actionsCell}`}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <span className={styles.rowActions}>
            {hasTrader ? (
              <>
                <GatedActionButton
                  icon={X}
                  onClick={onClose}
                  disabledTooltip={CLOSE_DISABLED_TOOLTIP}
                  ariaLabel="Close position"
                />
                <IconButton
                  icon={SlidersHorizontal}
                  elevated
                  ariaLabel="Manage position"
                  title="Manage position"
                  aria-haspopup="dialog"
                  onClick={onOpenManage}
                />
              </>
            ) : null}
          </span>
        </span>
      ) : null}
      <span
        className={`${styles.cell} ${styles.actionsCell}`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {hasPositionProtection ? (
          <span className={styles.tpslCell}>
            <FitCell className={`${styles.fitCellFlex} ${styles.tpslValue}`}>{tpslText}</FitCell>
            <IconButton
              icon={Pencil}
              elevated
              ariaLabel="Edit take profit and stop loss"
              title="Edit take profit and stop loss"
              aria-haspopup="dialog"
              onClick={onEditTpsl}
            />
          </span>
        ) : (
          <FitCell>{tpslText}</FitCell>
        )}
      </span>
    </div>
  )
}
