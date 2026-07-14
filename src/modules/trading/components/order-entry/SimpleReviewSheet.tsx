import { Sheet } from '@/modules/shared/components/Sheet'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import { StatRow } from '@/modules/shared/components/stat-row'
import { formatUsd } from '@/modules/shared/utils/format-number'
import styles from './simple-order-ticket.module.css'
import { REVIEW_SHEET_TITLE } from './order-entry.constants'
import type { SimpleReviewSheetProps } from './order-entry.types'

/**
 * The confirm step. The ticket's primary button opens this rather than placing
 * the order, so the numbers that actually decide the trade — what it costs you
 * (margin), how big it really is (position size), and where it dies (liq. price)
 * — are read once, deliberately, before anything is sent.
 *
 * Liquidation is a labelled number here, not a prose warning. That reverses the
 * casino build's D16; a leveraged trader needs the price, not a sentence.
 */
export function SimpleReviewSheet({
  isOpen,
  onClose,
  ticket,
  baseAsset,
}: SimpleReviewSheetProps) {
  const { form, estimates, isSubmitting, isSpot, markPrice, submit } = ticket

  const isBuy = form.side === 'buy'
  const actionLabel = isSpot ? (isBuy ? 'Buy' : 'Sell') : isBuy ? 'Long' : 'Short'
  const headline = ticket.isPriceTargetOn ? `${actionLabel} limit` : actionLabel

  // The venue prices the draft, so the estimates are the source of truth for
  // notional/margin — never re-derived here (that drift is what shipped the
  // casino ticket's hand-rolled margin math).
  const isLinear = estimates.kind === 'linear'
  const notional = estimates.notional
  const margin = isLinear ? estimates.margin : 0
  const liquidationPrice = isLinear ? estimates.liquidationPrice : 0
  const showLiquidation = isLinear && !isSpot && !ticket.isPriceTargetOn

  const limitPrice = form.priceInput.trim()

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      side="bottom"
      ariaLabel="Review order"
      title={REVIEW_SHEET_TITLE}
    >
      <div className={styles.review} data-testid="simple-review-sheet">
        <p className={styles.reviewHeadline} data-testid="review-headline">
          <span className={isBuy ? styles.reviewUp : styles.reviewDown}>{headline}</span>{' '}
          {baseAsset}
        </p>

        <div className={styles.reviewRows}>
          <StatRow label="Position size" value={formatUsd(notional)} />
          {isSpot ? null : <StatRow label="Margin" value={formatUsd(margin)} />}
          {ticket.isPriceTargetOn ? (
            <StatRow label="Limit price" value={limitPrice === '' ? '--' : `$${limitPrice}`} />
          ) : (
            <StatRow label="Mark price" value={formatUsd(markPrice)} />
          )}
          {showLiquidation ? (
            <StatRow
              label="Liq. price"
              value={formatUsd(liquidationPrice)}
              tone={isBuy ? 'down' : 'up'}
            />
          ) : null}
          <StatRow label="Fee" value={formatUsd(estimates.fee)} noDivider />
        </div>

        <PixelButton
          variant={isBuy ? 'directionUp' : 'directionDown'}
          size="md"
          fullWidth
          elevated
          disabled={isSubmitting}
          onClick={submit}
          data-testid="review-confirm"
        >
          {isSubmitting ? 'Submitting…' : `Confirm ${headline.toLowerCase()}`}
        </PixelButton>
      </div>
    </Sheet>
  )
}
