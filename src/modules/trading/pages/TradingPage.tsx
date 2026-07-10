import { LazyChart } from '../components/chart'
import {
  BetAmountChips,
  ConfirmBetSheet,
  DirectionButtons,
  LiveBetRow,
  MarketHeader,
  MultiplierControl,
} from '../components/casino-trade'
import { useCasinoTrade } from '../hooks/use-casino-trade'
import styles from './trading-page.module.css'
import casino from '../components/casino-trade/casino-trade.module.css'

/**
 * The Casino-Mode trade screen (PRD §8). Market header + lightweight-charts
 * price chart, then the bet ticket: amount (margin) chips, multiplier, and the
 * UP/DOWN commit. Tapping a direction opens the confirm sheet (liquidation
 * prose + magenta PLACE BET). An open bet on this market renders a live row with
 * Cash Out. No orderbook / depth / trades / funding (D7).
 */
export function TradingPage() {
  const trade = useCasinoTrade()

  return (
    <div className={`${styles.shell} ambient-cyan`} data-testid="casino-trade-shell">
      <MarketHeader
        ticker={trade.ticker}
        markPrice={trade.markPrice}
        change24hPct={trade.change24hPct}
      />

      <div className={styles.chartCard}>
        <LazyChart />
      </div>

      {trade.liveBet ? (
        <LiveBetRow
          liveBet={trade.liveBet}
          isCashingOut={trade.isCashingOut}
          onCashOut={trade.cashOut}
        />
      ) : null}

      <span className={casino.sectionLabel}>Your bet</span>
      <BetAmountChips
        presets={trade.betPresets}
        betAmount={trade.betAmount}
        onSelect={trade.selectAmount}
        onMax={trade.selectMax}
      />

      <MultiplierControl
        leverage={trade.leverage}
        maxLeverage={trade.maxLeverage}
        onChange={trade.setMultiplier}
      />

      <DirectionButtons canBet={trade.canBet} onPick={trade.openConfirm} />

      <ConfirmBetSheet
        pendingBet={trade.pendingBet}
        onClose={trade.closeConfirm}
        onPrimary={trade.confirmPrimary}
      />
    </div>
  )
}
