import { useCallback, useEffect, useMemo, useState } from 'react'
import { ResultAsync } from 'neverthrow'
import { logger } from '../logger'
import { supportConfig } from '../support.config'
import { buildErrorReport, normalizeError } from './error-boundary.utils'
import { COPY_FEEDBACK_MS, ERROR_BOUNDARY_LOG_MODULE } from './error-boundary.constants'
import type { ErrorFallbackProps, UseErrorFallbackResult } from './error-boundary.types'

const log = logger.child({ module: ERROR_BOUNDARY_LOG_MODULE })

/**
 * Owns the crash screen's state: the normalized error, the copy-paste report,
 * the "copied" confirmation, and the recovery navigations. Recovery is a hard
 * navigation (`reload` / assign `/`) on purpose — the React tree is already in
 * an unknown state, so a soft in-app transition can't be trusted to unwind it.
 */
export function useErrorFallback({ error }: ErrorFallbackProps): UseErrorFallbackResult {
  const [copied, setCopied] = useState(false)

  const normalized = useMemo(() => normalizeError(error), [error])

  const report = useMemo(
    () =>
      buildErrorReport({
        ...normalized,
        url: window.location.href,
        userAgent: window.navigator.userAgent,
        timestamp: new Date().toISOString(),
      }),
    [normalized],
  )

  const isClipboardSupported = typeof navigator !== 'undefined' && Boolean(navigator.clipboard)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copyReport = useCallback(() => {
    if (!isClipboardSupported) return
    ResultAsync.fromPromise(navigator.clipboard.writeText(report), (cause) => cause).match(
      () => setCopied(true),
      (cause) => log.warn({ errorMessage: String(cause) }, 'clipboard copy failed'),
    )
  }, [report, isClipboardSupported])

  const reload = useCallback(() => window.location.reload(), [])
  const goHome = useCallback(() => window.location.assign('/'), [])

  return {
    normalized,
    report,
    copied,
    isClipboardSupported,
    discordInviteUrl: supportConfig.discordInviteUrl,
    xUrl: supportConfig.xUrl,
    copyReport,
    reload,
    goHome,
  }
}
