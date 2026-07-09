import { Component } from 'react'
import { logger } from '../logger'
import { ErrorFallback } from './ErrorFallback'
import { normalizeError, toLogFields } from './error-boundary.utils'
import { ERROR_BOUNDARY_LOG_MODULE } from './error-boundary.constants'
import type { AppErrorBoundaryProps, AppErrorBoundaryState } from './error-boundary.types'

const log = logger.child({ module: ERROR_BOUNDARY_LOG_MODULE })

/**
 * Last-resort React error boundary wrapping the whole app (mounted in main.tsx,
 * above the providers). It catches render/lifecycle crashes that the router's
 * own error handling can't see — a provider blowing up, or anything thrown
 * outside a routed component. Router loader/route errors are handled by
 * {@link RouteErrorBoundary}; both render the same {@link ErrorFallback}.
 *
 * A class component by necessity: `getDerivedStateFromError` / `componentDidCatch`
 * have no hook equivalent (the React Compiler leaves classes untouched).
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: unknown) {
    log.error(toLogFields(normalizeError(error)), 'render error')
  }

  render() {
    if (this.state.hasError) return <ErrorFallback error={this.state.error} />
    return this.props.children
  }
}
