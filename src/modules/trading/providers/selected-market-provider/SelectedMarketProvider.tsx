import { useSelectedMarketProvider } from './use-selected-market-provider'
import { SelectedMarketContext } from './selected-market-provider.context'
import type { SelectedMarketProviderProps } from './selected-market-provider.types'

export function SelectedMarketProvider({ children, initialSymbol }: SelectedMarketProviderProps) {
  const marketState = useSelectedMarketProvider(initialSymbol)

  return (
    <SelectedMarketContext value={marketState}>
      {children}
    </SelectedMarketContext>
  )
}
