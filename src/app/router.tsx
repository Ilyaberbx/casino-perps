import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './app-shell'
import { AccountSessionRoot } from './app-shell/AccountSessionRoot'
import { RouteErrorBoundary } from './error-boundary'
import { DevCrashPage } from './error-boundary/DevCrashPage'
import type { RouteObject } from 'react-router-dom'
import {
  SelectedMarketProvider,
  LeverageMarginProvider,
  OrderIntentProvider,
  PerpSuggestionSheetProvider,
  SuggestionPreviewProvider,
  TradingPage,
} from '@/modules/trading'

// DEV-ONLY: a reachable route that triggers the error boundary on demand, so
// the crash screen can be previewed without editing source. Statically dropped
// from production builds (`import.meta.env.DEV` folds to `false`). Its own
// errorElement keeps it isolated from the session providers above.
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [{ path: 'dev/crash', element: <DevCrashPage />, errorElement: <RouteErrorBoundary /> }]
  : []

export const router = createBrowserRouter([
  {
    element: <AccountSessionRoot />,
    // Any loader/action/render error in the routed tree becomes a full-screen
    // crash takeover. The class AppErrorBoundary (main.tsx) is the backstop for
    // provider-level crashes the router can't see.
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/trade" replace /> },
          {
            path: 'trade',
            element: (
              <SelectedMarketProvider>
                <OrderIntentProvider>
                  <LeverageMarginProvider>
                    <PerpSuggestionSheetProvider>
                      <SuggestionPreviewProvider>
                        <TradingPage />
                      </SuggestionPreviewProvider>
                    </PerpSuggestionSheetProvider>
                  </LeverageMarginProvider>
                </OrderIntentProvider>
              </SelectedMarketProvider>
            ),
          },
          {
            path: 'portfolio',
            // Code-split: chart.js + react-chartjs-2 (portfolio-only) load on
            // navigation, not in the initial/trade chunk. react-router-dom v7
            // route-level lazy keeps the composition root clean.
            lazy: async () => ({ Component: (await import('@/modules/portfolio')).PortfolioPage }),
          },
        ],
      },
    ],
  },
  ...devRoutes,
])
