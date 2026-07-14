import { useTradingMode } from './use-trading-mode'

/**
 * Thin selector over {@link useTradingMode}: `true` when the global mode is
 * `simple`. Simple is the default — it drives the trade page's condensed
 * ticket + position panel. Pro swaps in the full terminal (orderbook, trades
 * tape, the complete `OrderEntry`). The check is device-independent: there is
 * one mode per browser, on every viewport.
 */
export function useIsSimpleMode(): boolean {
  return useTradingMode().mode === 'simple'
}
