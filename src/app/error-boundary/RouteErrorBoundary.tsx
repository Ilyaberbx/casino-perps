import { ErrorFallback } from './ErrorFallback'
import { useRouteErrorBoundary } from './use-route-error-boundary'

/**
 * React Router `errorElement` — catches loader/action/render errors thrown
 * anywhere in the routed tree and renders the shared crash screen. Wired at the
 * root route in router.tsx, so a route error becomes a full-screen takeover.
 */
export function RouteErrorBoundary() {
  const error = useRouteErrorBoundary()
  return <ErrorFallback error={error} />
}
