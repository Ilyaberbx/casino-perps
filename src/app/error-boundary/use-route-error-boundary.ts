import { useEffect } from 'react'
import { useRouteError } from 'react-router-dom'
import { logger } from '../logger'
import { normalizeError, toLogFields } from './error-boundary.utils'
import { ERROR_BOUNDARY_LOG_MODULE } from './error-boundary.constants'

const log = logger.child({ module: ERROR_BOUNDARY_LOG_MODULE })

/** Reads the router's caught error and logs it once (per distinct error). The
 *  raw value is returned untyped — {@link ErrorFallback} normalizes it. */
export function useRouteErrorBoundary(): unknown {
  const error = useRouteError()

  useEffect(() => {
    log.error(toLogFields(normalizeError(error)), 'route error')
  }, [error])

  return error
}
