import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { StatusCodes } from 'http-status-codes'
import type { ResultAsync } from 'neverthrow'
import { useAuth } from '../providers/auth-provider'
import { getMe } from '../api/get-me'
import { onboard } from '../api/onboard'
import type { AuthError, Me } from '../domain/types'
import type { HttpError } from '@/modules/shared/http'
import { OnboardingFlowContext } from '../providers/onboarding-flow-provider/onboarding-flow-provider.context'
import type { ApplyMe, OnboardingState, RefreshMe } from './onboarding-flow.types'

export type { OnboardingState } from './onboarding-flow.types'

export function useOnboardingFlow(): OnboardingState {
  const fromCtx = useContext(OnboardingFlowContext)
  const own = useOwnOnboardingFlow(fromCtx === null)
  return fromCtx ?? own
}

export function useOwnOnboardingFlow(active: boolean): OnboardingState {
  const {
    ready,
    authenticated,
    privyId,
    walletAddress,
    walletSource,
    walletReady,
    apiClient,
    enrollMfa,
  } = useAuth()
  const [phase, setPhase] = useState<OnboardingState['kind']>('idle')
  const [me, setMe] = useState<Me | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const startedRef = useRef(false)

  const isConnected = ready && authenticated && walletReady
  const canStart = active && isConnected && privyId !== null && walletAddress !== null

  useEffect(() => {
    if (!isConnected) return
    return () => {
      setPhase('idle')
      setMe(null)
      setErrorMessage(null)
      startedRef.current = false
    }
  }, [isConnected])

  useEffect(() => {
    if (!canStart) return
    if (startedRef.current) return
    startedRef.current = true

    let cancelled = false
    const run = async () => {
      setPhase('resolving')
      const meResult = await getMe(apiClient)
      if (cancelled) return
      if (meResult.isOk()) {
        // Returning user — a real handle already exists, go straight to ready.
        setMe(meResult.value)
        setPhase('ready')
        return
      }
      const meError = meResult.error
      const isNotFound = meError.kind === 'api' && meError.status === StatusCodes.NOT_FOUND
      if (!isNotFound) {
        setErrorMessage(meError.message)
        setPhase('error')
        return
      }
      // New account: the user must choose a handle BEFORE the account row is
      // created (no provisional/default handle). The row is created by `onboard`
      // when they submit the handle (see `submitHandle`).
      setPhase('needs-handle')
    }
    void run()
    return () => {
      cancelled = true
      // Allow a cancelled run to restart so a cancelled in-flight run does not
      // leave the flow frozen at `resolving` (the `isConnected` cleanup never
      // fires while `walletReady` stays true).
      startedRef.current = false
    }
  }, [canStart, apiClient])

  // Handle submission IS account creation: `onboard` creates the user row with
  // the chosen handle. A 409 (handle taken) surfaces as an `HttpError` the
  // Handle step renders inline; on success the new account advances to the MFA
  // step.
  const submitHandle = useCallback(
    (handle: string, inviteCode?: string): ResultAsync<void, HttpError> =>
      onboard(apiClient, {
        privyId: privyId!,
        walletAddress: walletAddress!,
        source: walletSource ?? 'embedded',
        handle,
        inviteCode,
      }).map((account) => {
        setMe(account)
        setPhase('needs-mfa')
      }),
    [apiClient, privyId, walletAddress, walletSource],
  )

  // MFA (setup or skip) hands off to the new-account Personalize step, not
  // straight to ready — the modal stays open for the appearance prefs.
  const setupMfa = useCallback(
    () => enrollMfa().map(() => setPhase('needs-personalize')),
    [enrollMfa],
  )

  const skipMfa = useCallback(() => setPhase('needs-personalize'), [])

  const finishPersonalize = useCallback(() => setPhase('ready'), [])

  // Replace the canonical `me` with a server-returned payload (after a
  // select/import/remove already returned a fresh `Me`). Does NOT touch
  // `startedRef` — the one-shot resolve gate is unaffected.
  const applyMe = useCallback<ApplyMe>((next) => setMe(next), [])

  // Re-GET /api/account/me and apply the result so an out-of-band change (another
  // device, a manual DB edit) reconciles. On failure the cached `me` is left
  // intact and the error is returned to the caller (no state thrash, no gate
  // change).
  const refreshMe = useCallback<RefreshMe>(
    () => getMe(apiClient).map((next) => {
      setMe(next)
      return next
    }),
    [apiClient],
  )

  return buildState({
    phase,
    me,
    errorMessage,
    submitHandle,
    setupMfa,
    skipMfa,
    finishPersonalize,
    applyMe,
    refreshMe,
  })
}

function buildState(args: {
  phase: OnboardingState['kind']
  me: Me | null
  errorMessage: string | null
  submitHandle: (handle: string, inviteCode?: string) => ResultAsync<void, HttpError>
  setupMfa: () => ResultAsync<void, AuthError>
  skipMfa: () => void
  finishPersonalize: () => void
  applyMe: ApplyMe
  refreshMe: RefreshMe
}): OnboardingState {
  const { phase, me, errorMessage } = args
  if (phase === 'ready' && me !== null) {
    return { kind: 'ready', me, applyMe: args.applyMe, refreshMe: args.refreshMe }
  }
  if (phase === 'needs-handle') return { kind: 'needs-handle', submitHandle: args.submitHandle }
  if (phase === 'needs-mfa') {
    return { kind: 'needs-mfa', setupMfa: args.setupMfa, skipMfa: args.skipMfa }
  }
  if (phase === 'needs-personalize') {
    return { kind: 'needs-personalize', finishPersonalize: args.finishPersonalize }
  }
  if (phase === 'error') return { kind: 'error', message: errorMessage ?? 'Onboarding failed' }
  if (phase === 'resolving') return { kind: 'resolving' }
  if (phase === 'onboarding') return { kind: 'onboarding' }
  return { kind: 'idle' }
}
