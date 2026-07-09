import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { logger } from '@/app/logger'
import { requestIdFrom } from '@/modules/shared/http'
import {
  buildDelegationScope,
  formatScopeCopy,
  grantedScopeOf,
  validateDelegationCap,
} from '../../agent-balance.utils'
import {
  DELEGATION_CAP_USD,
  DELEGATION_EXPIRY_DAYS,
  DELEGATION_TTL_PRESET_DAYS,
} from '../../agent-balance.constants'
import type {
  AgentWalletAddress,
  DelegationConsentErrorReason,
  DelegationConsentPhase,
  DelegationConsentViewModel,
  DelegationGrantError,
  DelegationGrantPort,
  DelegationStatusView,
} from '../../agent-balance.types'

const log = logger.child({ module: 'agent-balance-delegation' })

/** The empty status view used before the first read resolves / on a read error. */
const NOT_GRANTED_VIEW: DelegationStatusView = {
  status: 'not-granted',
  appSignerId: null,
  capUsd: null,
  expiresAt: null,
}

/** Stable default clock so `deps.now` omission does not churn callbacks. */
const defaultNow = (): Date => new Date()

/**
 * Collaborators for the delegation-consent smart hook. Injected so the hook is
 * unit-testable without Privy / HTTP: tests supply a status reader and a grant
 * port (a fake whose `grant` / `revoke` yield `okAsync` / `errAsync`).
 * Production binds the env-backed `getDelegationStatus` + the
 * `createDelegationGrant` seam (which wraps the live Privy session signer).
 */
export interface DelegationConsentDeps {
  /** The configured Minara recipient the scoped signer may pay (the only address). */
  readonly recipient: AgentWalletAddress
  /** Reads the current standing delegation view (status + granted cap / expiry). */
  readonly getStatus: () => Promise<DelegationStatusView>
  /** Resolves the delegation-grant seam (signer registration + server record). */
  readonly getGrantPort: () => DelegationGrantPort
  /** Injected clock so the built `expiresAt` is deterministic under test. */
  readonly now?: () => Date
}

/**
 * Smart hook behind the dumb `<DelegationConsent>` body (issue #205). On mount it
 * reads the standing delegation view; the user configures the grant `capUsd` and
 * `ttlDays`, then `grant` builds the scope from those inputs and runs the one-time
 * scoped consent (Privy session signer → server record), flipping the status to
 * `active`; `revoke` pulls the standing signer and reflects the revoked status.
 * The active card shows the *granted* scope; while editing it previews the scope
 * derived from the current inputs. A declined consent popup returns
 * non-destructively to `idle`.
 */
export function useDelegationConsent(
  deps: DelegationConsentDeps,
): DelegationConsentViewModel {
  const [phase, setPhase] = useState<DelegationConsentPhase>('loading')
  const [statusView, setStatusView] = useState<DelegationStatusView>(NOT_GRANTED_VIEW)
  const [errorReason, setErrorReason] =
    useState<DelegationConsentErrorReason | null>(null)
  const [capUsd, setCapUsd] = useState<string>(DELEGATION_CAP_USD)
  const [ttlDays, setTtlDays] = useState<number>(DELEGATION_EXPIRY_DAYS)

  const { getStatus, getGrantPort, recipient } = deps
  const now = deps.now ?? defaultNow

  // Flips once the User grants / revokes — gates the initial status read so a
  // late resolution can never clobber a fresh action's result.
  const hasUserActed = useRef(false)

  useEffect(() => {
    let cancelled = false
    getStatus().then((next) => {
      if (cancelled) return
      if (hasUserActed.current) return
      setStatusView(next)
      setPhase('idle')
    })
    return () => {
      cancelled = true
    }
  }, [getStatus])

  const capValidation = useMemo(() => validateDelegationCap(capUsd), [capUsd])

  const grant = useCallback((): void => {
    if (!capValidation.isValid) return
    hasUserActed.current = true
    setErrorReason(null)
    setPhase('granting')
    const scope = buildDelegationScope(recipient, capValidation.value, ttlDays, now())
    log.info({}, 'delegation grant')
    getGrantPort()
      .grant(scope)
      .match(
        (next) => {
          log.info({ status: next }, 'delegation granted')
          // The grant response carries only the status; the granted cap / expiry
          // are exactly what we just submitted, so reflect them for the card.
          setStatusView((prev) => ({
            status: next,
            appSignerId: prev.appSignerId,
            capUsd: scope.capUsd,
            expiresAt: scope.expiresAt,
          }))
          setPhase('idle')
        },
        (error) => settleGrantError(error, setErrorReason, setPhase),
      )
  }, [getGrantPort, recipient, capValidation, ttlDays, now])

  const revoke = useCallback((): void => {
    hasUserActed.current = true
    setErrorReason(null)
    setPhase('revoking')
    log.info({}, 'delegation revoke')
    getGrantPort()
      .revoke()
      .match(
        (next) => {
          log.info({ status: next }, 'delegation revoked')
          setStatusView((prev) => ({ ...prev, status: next }))
          setPhase('idle')
        },
        (error) => settleGrantError(error, setErrorReason, setPhase),
      )
  }, [getGrantPort])

  const scope = useMemo(() => {
    const granted = grantedScopeOf(statusView, recipient)
    if (granted !== null) return formatScopeCopy(granted)
    const previewCap = capValidation.value ?? 0
    return formatScopeCopy(buildDelegationScope(recipient, previewCap, ttlDays, now()))
  }, [statusView, recipient, capValidation, ttlDays, now])

  return {
    phase,
    status: statusView.status,
    isActive: statusView.status === 'active',
    scope,
    capUsd,
    capInvalidReason: capValidation.isValid ? null : capValidation.reason,
    ttlDays,
    ttlPresets: DELEGATION_TTL_PRESET_DAYS,
    canGrant: capValidation.isValid,
    errorReason,
    setCapUsd,
    setTtlDays,
    grant,
    revoke,
  }
}

/**
 * Settle a grant / revoke failure. A declined consent popup (`signer-rejected`)
 * returns non-destructively to `idle` — the consent surface stays on offer;
 * every other failure lands in `error` with the mapped reason.
 */
function settleGrantError(
  error: DelegationGrantError,
  setErrorReason: (reason: DelegationConsentErrorReason | null) => void,
  setPhase: (phase: DelegationConsentPhase) => void,
): void {
  const isRejection = error.kind === 'signer-rejected'
  if (isRejection) {
    log.info({}, 'delegation consent declined')
    setPhase('idle')
    return
  }
  const requestId = requestIdFrom(error)
  log.warn(
    { kind: error.kind, ...(requestId ? { requestId } : {}) },
    'delegation grant failed',
  )
  setErrorReason(error.kind)
  setPhase('error')
}
