import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './app-shell'
import { AccountSessionRoot } from './app-shell/AccountSessionRoot'
import { RouteErrorBoundary } from './error-boundary'
import { DevCrashPage } from './error-boundary/DevCrashPage'
import { TradeRoute } from './TradeRoute'
import type { RouteObject } from 'react-router-dom'
import { DEFAULT_SELECTED_MARKET } from '@/modules/trading'
import { LobbyPage } from '@/modules/lobby'

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
          // `/` is the lobby (PRD 0008 D15); the old `/ → /trade` redirect is gone.
          { index: true, element: <LobbyPage /> },
          // Bare `/trade` resolves to the default market's trade screen.
          {
            path: 'trade',
            element: <Navigate to={`/trade/${DEFAULT_SELECTED_MARKET}`} replace />,
          },
          { path: 'trade/:symbol', element: <TradeRoute /> },
          {
            path: 'my-bets',
            // Code-split: the My Bets page loads on navigation, keeping it out of
            // the initial/lobby chunk. react-router-dom v7 route-level lazy.
            lazy: async () => ({ Component: (await import('@/modules/my-bets')).MyBetsPage }),
          },
        ],
      },
    ],
  },
  ...devRoutes,
])
