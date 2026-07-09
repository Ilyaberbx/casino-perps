import type { ReactNode } from 'react'
import { SelectedMarketProvider } from '../selected-market-provider'
import { OrderIntentProvider } from '../order-intent-provider'
import { LeverageMarginProvider } from '../leverage-margin'
import { PerpSuggestionSheetProvider } from '../perp-suggestion-sheet-provider'
import { SuggestionPreviewProvider } from '../suggestion-preview-provider'

/**
 * The context stack the mobile trade dock's actions depend on: the selected
 * market + order-intent bus + leverage/margin state (order entry) and the AI
 * suggestion + preview controllers (Ask AI). The /trade route already nests these
 * around `TradingPage` (see `app/router.tsx`); the portfolio page wraps its dock
 * in this so Place Order / Ask AI work there too without re-declaring the stack.
 */
export function TradeDockProviders({ children }: { readonly children: ReactNode }) {
  return (
    <SelectedMarketProvider>
      <OrderIntentProvider>
        <LeverageMarginProvider>
          <PerpSuggestionSheetProvider>
            <SuggestionPreviewProvider>{children}</SuggestionPreviewProvider>
          </PerpSuggestionSheetProvider>
        </LeverageMarginProvider>
      </OrderIntentProvider>
    </SelectedMarketProvider>
  )
}
