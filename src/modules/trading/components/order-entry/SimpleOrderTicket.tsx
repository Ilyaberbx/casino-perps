import { useSimpleOrderTicket } from './use-simple-order-ticket'
import { SideToggle } from './SideToggle'
import { SizeInput } from './SizeInput'
import { PriceInput } from './PriceInput'
import { PriceTargetToggle } from './PriceTargetToggle'
import { OrderInfoRows } from './OrderInfoRows'
import { PreTradeSummary } from './PreTradeSummary'
import { SubmitButton } from './SubmitButton'
import { StopSpectatingButton } from './StopSpectatingButton'
import { SimpleReviewSheet } from './SimpleReviewSheet'
import { DisclaimerFooter } from './DisclaimerFooter'
import { LeverageMargin } from '../leverage-margin/LeverageMargin'
import { ConnectWalletGateButton } from '@/modules/account'
import { VenueOnboardingGateButton } from '@/modules/shared/components/VenueOnboardingGateButton'
import { TradeableFundsGateButton } from '@/modules/shared/components/TradeableFundsGateButton'
import { Hip3AbstractionGateButton } from '@/modules/shared/components/hip3-abstraction-gate-button'
import { useCapabilityOptional } from '@/modules/shared/providers/venue-provider'
import { useSelectedMarketContext } from '../../providers/selected-market-provider'
import styles from './simple-order-ticket.module.css'
import entryStyles from './order-entry.module.css'

/**
 * The Simple trade ticket. Same brain as the Pro ticket (`useOrderEntry`) — the
 * Pro-only affordances are suppressed purely by not rendering them, so their
 * defaults (market order, GTC, no reduce-only, no entry TP/SL, venue slippage)
 * are exactly what Simple wants. Nothing is special-cased in the hook.
 *
 * Market by default; the price-target toggle turns the order into a limit. The
 * primary button opens the review sheet rather than firing the order.
 */
export function SimpleOrderTicket() {
  const trader = useCapabilityOptional('trader')
  if (trader === undefined) {
    return <SimpleOrderTicketReadOnly />
  }
  return <SimpleOrderTicketActive />
}

function SimpleOrderTicketReadOnly() {
  return (
    <div className={styles.ticket}>
      <div className={entryStyles.readOnlyNotice}>
        This venue is <strong>read-only</strong>. Trading is not available here.
      </div>
    </div>
  )
}

function SimpleOrderTicketActive() {
  const ticket = useSimpleOrderTicket()
  const { market } = useSelectedMarketContext()

  const {
    form,
    validation,
    isSubmitting,
    errorMessage,
    isSpectating,
    markPrice,
    availableToTrade,
    availableUnit,
    isSpot,
    isHip3,
    minOrderValueHint,
    currentPositionSize,
    sizeFraction,
    estimates,
  } = ticket

  const isSubmitDisabled = !validation.canSubmit || isSubmitting

  return (
    <div className={styles.ticket} data-testid="simple-order-ticket">
      <div className={styles.header}>
        <SideToggle side={form.side} onSideChange={ticket.setSide} />
        <PriceTargetToggle
          isOn={ticket.isPriceTargetOn}
          onToggle={ticket.togglePriceTarget}
        />
      </div>

      {/* Spot has no leverage or margin mode to choose. */}
      {isSpot ? null : <LeverageMargin />}

      <OrderInfoRows
        availableToTrade={availableToTrade}
        availableUnit={availableUnit}
        currentPositionSize={currentPositionSize}
        baseAsset={market.baseAsset}
      />

      {ticket.isPriceTargetOn ? (
        <PriceInput
          label="Limit price"
          value={form.priceInput}
          isValid={validation.isPriceValid}
          isDisabled={false}
          midPrice={markPrice}
          onChange={ticket.setPriceInput}
          onUseMid={ticket.setPriceFromMid}
        />
      ) : null}

      <SizeInput
        value={form.sizeInput}
        unit={form.sizeUnit}
        isValid={validation.isSizeValid}
        baseAsset={market.baseAsset}
        quoteLabel="USDC"
        fraction={sizeFraction}
        onChange={ticket.setSizeInput}
        onUnitChange={ticket.setSizeUnit}
        onFractionChange={ticket.setSizeFromBuyingPowerFraction}
      />
      {minOrderValueHint ? (
        <div className={entryStyles.errorMessage}>{minOrderValueHint}</div>
      ) : null}

      {errorMessage ? <div className={entryStyles.errorMessage}>{errorMessage}</div> : null}

      {/* Slippage stays on the venue default in Simple — `slippage={null}`. */}
      <PreTradeSummary
        estimates={estimates}
        slippage={null}
        showLiquidation={!isSpot && !ticket.isPriceTargetOn}
      />

      {isSpectating ? (
        <StopSpectatingButton onStopSpectating={ticket.stopSpectating} />
      ) : (
        <ConnectWalletGateButton>
          <VenueOnboardingGateButton>
            <TradeableFundsGateButton>
              <Hip3AbstractionGateButton isHip3={isHip3}>
                <SubmitButton
                  side={form.side}
                  orderType={form.orderType}
                  isDisabled={isSubmitDisabled}
                  isSubmitting={isSubmitting}
                  onSubmit={ticket.openReview}
                />
              </Hip3AbstractionGateButton>
            </TradeableFundsGateButton>
          </VenueOnboardingGateButton>
        </ConnectWalletGateButton>
      )}

      <SimpleReviewSheet
        isOpen={ticket.isReviewOpen}
        onClose={ticket.closeReview}
        ticket={ticket}
        baseAsset={market.baseAsset}
      />

      <DisclaimerFooter />
    </div>
  )
}
