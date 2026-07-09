import { useCallback, useEffect, useState } from 'react'
import type { ResultAsync } from 'neverthrow'
import { useToast } from '@/modules/shared/providers/toast-provider'
import { useAppConfig } from '@/modules/shared/providers/app-config-provider'
import { useAuth } from '../../providers/auth-provider'
import { checkHandleAvailable } from '../../api/check-handle-available'
import { parseHandle } from '../../domain/handle'
import type { HttpError } from '@/modules/shared/http'
import { HANDLE_DEBOUNCE_MS } from './onboarding-stepper.constants'
import { deriveAvailability, inviteErrorFrom, submitErrorToast } from './onboarding-stepper.utils'
import type { HandleCheck, HandleStepView } from './onboarding-stepper.types'

export function useHandleStep(
  submitHandle: (handle: string, inviteCode?: string) => ResultAsync<void, HttpError>,
): HandleStepView {
  const { apiClient } = useAuth()
  const { inviteGateEnabled } = useAppConfig()
  const toast = useToast()
  const [handle, setHandle] = useState('')
  // The last *completed* availability check, keyed to the handle it was for.
  // Set only inside the async debounce callback — never synchronously in the
  // effect body — so the displayed `availability` is derived, not stored.
  const [check, setCheck] = useState<HandleCheck | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)

  const parsed = parseHandle(handle)
  const isFormatValid = parsed.isOk()
  const formatError = handle !== '' && parsed.isErr() ? parsed.error : null
  const normalised = parsed.isOk() ? parsed.value : null

  useEffect(() => {
    if (normalised === null) return
    // Skip the request when the normalised handle already equals the last
    // *completed* check — the user typed back to a handle we just resolved, so
    // re-querying it would be a wasted round-trip (Opt-H1, client half).
    const isAlreadyChecked = check !== null && check.handle === normalised
    if (isAlreadyChecked) return
    const timer = setTimeout(() => {
      void checkHandleAvailable(apiClient, normalised).match(
        ({ available }) => setCheck({ handle: normalised, status: available ? 'available' : 'taken' }),
        // A 400 (bad format) is an inline format error, NOT "taken" — keep the
        // availability indicator neutral and let `formatError` carry the message.
        () => setCheck({ handle: normalised, status: 'idle' }),
      )
    }, HANDLE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [normalised, apiClient, check])

  const availability = deriveAvailability(normalised, check)
  const onHandleChange = useCallback((next: string) => setHandle(next.toLowerCase()), [])
  const onInviteCodeChange = useCallback((next: string) => {
    setInviteCode(next.toUpperCase())
    setInviteError(null)
  }, [])

  const isAvailable = availability === 'available'
  const isInviteSatisfied = !inviteGateEnabled || inviteCode.trim().length > 0
  const canContinue = isFormatValid && isAvailable && isInviteSatisfied && !isSubmitting

  const onContinue = useCallback(async () => {
    if (normalised === null) return
    setInviteError(null)
    setIsSubmitting(true)
    const code = inviteGateEnabled ? inviteCode.trim() : undefined
    const result = await submitHandle(normalised, code)
    setIsSubmitting(false)
    if (result.isOk()) return
    // An invite-specific failure renders inline next to the code field; every
    // other failure gets an honest toast — only a real HANDLE_TAKEN says "handle
    // may already be taken" (a 500/Privy/network error must not be disguised as
    // a taken handle).
    const inviteMessage = inviteErrorFrom(result.error)
    if (inviteMessage !== null) {
      setInviteError(inviteMessage)
      return
    }
    const { title, description } = submitErrorToast(result.error)
    toast.show({ variant: 'error', title, description })
  }, [normalised, inviteGateEnabled, inviteCode, submitHandle, toast])

  return {
    kind: 'handle',
    handle,
    formatError,
    availability,
    canContinue,
    isSubmitting,
    onHandleChange,
    onContinue,
    showInviteField: inviteGateEnabled,
    inviteCode,
    inviteError,
    onInviteCodeChange,
  }
}
