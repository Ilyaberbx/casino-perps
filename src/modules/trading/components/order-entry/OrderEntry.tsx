import { useOrderEntry } from './use-order-entry'
import { OrderTypeControl } from './OrderTypeControl'
import { SideToggle } from './SideToggle'
import { SizeInput } from './SizeInput'
import { PriceInput } from './PriceInput'
import { StopPriceInput } from './StopPriceInput'
import { TwapRunningTime } from './TwapRunningTime'
import { LeverageMargin } from '../leverage-margin/LeverageMargin'
import { OrderInfoRows } from './OrderInfoRows'
import { OrderOptions } from './OrderOptions'
import { EntryTpslSection } from './EntryTpslSection'
import { PreTradeSummary } from './PreTradeSummary'
import { DisclaimerFooter } from './DisclaimerFooter'
import { SubmitButton } from './SubmitButton'
import { StopSpectatingButton } from './StopSpectatingButton'
import { ConnectWalletGateButton } from '@/modules/account'
import { VenueOnboardingGateButton } from '@/modules/shared/components/VenueOnboardingGateButton'
import { TradeableFundsGateButton } from '@/modules/shared/components/TradeableFundsGateButton'
import { Hip3AbstractionGateButton } from '@/modules/shared/components/hip3-abstraction-gate-button'
import { useCapabilityOptional } from '@/modules/shared/providers/venue-provider'
import { useSelectedMarketContext } from '../../providers/selected-market-provider'
import styles from './order-entry.module.css'

export function OrderEntry() {
  const trader = useCapabilityOptional('trader')
  if (trader === undefined) {
    return <OrderEntryReadOnly />
  }
  return <OrderEntryActive />
}

function OrderEntryReadOnly() {
  return (
    <div className={styles.container}>
      <div className={styles.readOnlyNotice}>
        This venue is <strong>read-only</strong>. Trading is not available here.
      </div>
    </div>
  )
}

function OrderEntryActive() {
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
    slippageHint,
    currentPositionSize,
    sizeFraction,
    estimates,
    supportsStopOrders,
    supportsTwap,
    setOrderType,
    setSide,
    setSizeInput,
    setSizeUnit,
    setSizeFromBuyingPowerFraction,
    setPriceInput,
    setPriceFromMid,
    setStopPriceInput,
    setStopPriceFromMid,
    setTwapHours,
    setTwapMinutes,
    setRandomize,
    isProtectionApplicable,
    protection,
    setProtectionEnabled,
    setProtectionBasis,
    setProtectionLegPrice,
    setProtectionLegAmount,
    setSlippageInput,
    setReduceOnly,
    setTimeInForce,
    submit,
    stopSpectating,
  } = useOrderEntry()
  const { market } = useSelectedMarketContext()

  const isLimitMode = form.orderType === 'limit'
  const isStopLimitMode = form.orderType === 'stop-limit'
  const isStopMode = form.orderType === 'stop-market' || form.orderType === 'stop-limit'
  const isTwapMode = form.orderType === 'twap'
  const showsLimitPrice = isLimitMode || isStopLimitMode
  const isMarketMode = form.orderType === 'market'
  const isSubmitDisabled = !validation.canSubmit || isSubmitting
  const showsLiquidation = isMarketMode && !isSpot
  const slippageControl = isMarketMode
    ? { value: form.slippageInput, onChange: setSlippageInput }
    : null

  return (
    <div className={styles.container}>
      <SideToggle side={form.side} isSpot={isSpot} onSideChange={setSide} />
      <OrderTypeControl
        orderType={form.orderType}
        supportsStopOrders={!isSpot && supportsStopOrders}
        supportsTwap={!isSpot && supportsTwap}
        onOrderTypeChange={setOrderType}
      />
      {isSpot ? null : <LeverageMargin />}
      <OrderInfoRows
        availableToTrade={availableToTrade}
        availableUnit={availableUnit}
        currentPositionSize={currentPositionSize}
        baseAsset={market.baseAsset}
      />
      {isStopMode ? (
        <StopPriceInput
          value={form.stopPriceInput}
          isValid={validation.isStopPriceValid}
          midPrice={markPrice}
          onChange={setStopPriceInput}
          onUseMid={setStopPriceFromMid}
        />
      ) : null}
      {showsLimitPrice ? (
        <PriceInput
          label="Limit price"
          value={form.priceInput}
          isValid={validation.isPriceValid}
          isDisabled={false}
          midPrice={markPrice}
          onChange={setPriceInput}
          onUseMid={setPriceFromMid}
        />
      ) : null}
      {isTwapMode ? (
        <TwapRunningTime
          hoursInput={form.twapHoursInput}
          minutesInput={form.twapMinutesInput}
          isValid={validation.isTwapDurationValid}
          onHoursChange={setTwapHours}
          onMinutesChange={setTwapMinutes}
        />
      ) : null}
      <SizeInput
        value={form.sizeInput}
        unit={form.sizeUnit}
        isValid={validation.isSizeValid}
        baseAsset={market.baseAsset}
        quoteLabel="USDC"
        fraction={sizeFraction}
        onChange={setSizeInput}
        onUnitChange={setSizeUnit}
        onFractionChange={setSizeFromBuyingPowerFraction}
      />
      {minOrderValueHint ? (
        <div className={styles.errorMessage}>{minOrderValueHint}</div>
      ) : null}
      <OrderOptions
        showReduceOnly={!isSpot}
        reduceOnly={form.reduceOnly}
        onReduceOnlyChange={setReduceOnly}
        isLimit={isLimitMode}
        timeInForce={form.timeInForce}
        onTimeInForceChange={setTimeInForce}
        isTwap={isTwapMode}
        randomize={form.randomize}
        onRandomizeChange={setRandomize}
      />
      {isProtectionApplicable ? (
        <EntryTpslSection
          protection={protection}
          onEnabledChange={setProtectionEnabled}
          onBasisChange={setProtectionBasis}
          onLegPriceChange={setProtectionLegPrice}
          onLegAmountChange={setProtectionLegAmount}
        />
      ) : null}
      {errorMessage ? <div className={styles.errorMessage}>{errorMessage}</div> : null}
      <PreTradeSummary
        estimates={estimates}
        slippage={slippageControl}
        showLiquidation={showsLiquidation}
      />
      {slippageHint ? <div className={styles.errorMessage}>{slippageHint}</div> : null}
      {isSpectating ? (
        <StopSpectatingButton onStopSpectating={stopSpectating} />
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
                  onSubmit={submit}
                />
              </Hip3AbstractionGateButton>
            </TradeableFundsGateButton>
          </VenueOnboardingGateButton>
        </ConnectWalletGateButton>
      )}
      <DisclaimerFooter />
    </div>
  )
}
