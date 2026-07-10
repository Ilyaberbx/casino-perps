import { useParams } from 'react-router-dom'
import {
  SelectedMarketProvider,
  LeverageMarginProvider,
  OrderIntentProvider,
  TradingPage,
} from '@/modules/trading'

/**
 * The `/trade/:symbol` screen (PRD 0008 D15). The path `:symbol` (already URL-
 * decoded by the router) seeds `SelectedMarketProvider`, which then owns the
 * selected market from the path instead of the legacy `?market=` query.
 *
 * Lives outside `router.tsx` because that module also exports the non-component
 * `router`, which trips the `react-refresh/only-export-components` rule.
 */
export function TradeRoute() {
  const { symbol } = useParams<{ symbol: string }>()
  return (
    <SelectedMarketProvider initialSymbol={symbol}>
      <OrderIntentProvider>
        <LeverageMarginProvider>
          <TradingPage />
        </LeverageMarginProvider>
      </OrderIntentProvider>
    </SelectedMarketProvider>
  )
}
