import { useCallback, useState } from 'react'
import type { ResultAsync } from 'neverthrow'
import { useToast } from '@/modules/shared/providers/toast-provider'
import type { AuthError } from '../domain/types'

/**
 * Shared MFA-enrollment lifecycle for the 2FA enrol affordances (Account Modal's
 * 2FA section and the onboarding stepper's MFA step). Owns the `isEnrolling` flag
 * and an async `onSetup` that awaits the injected enroll `ResultAsync` and, on
 * error, toasts `'2FA setup failed'` with the caller's `failureDescription`. The
 * only thing that differs between consumers is that description, so it is the only
 * parameter beyond the enroll action itself.
 */
export function useMfaEnrollment(
  enroll: () => ResultAsync<void, AuthError>,
  failureDescription: string,
): { isEnrolling: boolean; onSetup: () => Promise<void> } {
  const toast = useToast()
  const [isEnrolling, setIsEnrolling] = useState(false)

  const onSetup = useCallback(async () => {
    setIsEnrolling(true)
    const result = await enroll()
    setIsEnrolling(false)
    if (result.isErr()) {
      toast.show({
        variant: 'error',
        title: '2FA setup failed',
        description: failureDescription,
      })
    }
  }, [enroll, failureDescription, toast])

  return { isEnrolling, onSetup }
}
