import { useCallback, useEffect, useState } from 'react'
import { useLoginWithEmail } from '@privy-io/react-auth'
import { ResultAsync } from 'neverthrow'
import { useToast } from '@/modules/shared/providers/toast-provider'
import { logger as appLogger } from '@/app/logger'
import { coerceToAuthError, describeAuthError } from '../../providers/auth-provider/auth-provider.utils'
import { isValidEmail } from './onboarding-stepper.utils'
import { RESEND_LOCKOUT_SECONDS } from './onboarding-stepper.constants'
import type { EmailStepView, OtpStepView } from './onboarding-stepper.types'

const logger = appLogger.child({ module: 'onboarding-stepper' })

export interface EmailOtpSteps {
  phase: 'email' | 'otp'
  emailView: EmailStepView
  otpView: OtpStepView
}

export function useEmailOtpSteps(): EmailOtpSteps {
  const { sendCode, loginWithCode, state } = useLoginWithEmail()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [phase, setPhase] = useState<'email' | 'otp'>('email')
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [resendSeconds, setResendSeconds] = useState(0)
  const isCounting = resendSeconds > 0

  useEffect(() => {
    if (!isCounting) return
    const interval = setInterval(() => setResendSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(interval)
  }, [isCounting])

  const requestCode = useCallback(
    async (target: string): Promise<boolean> => {
      const result = await ResultAsync.fromPromise(sendCode({ email: target }), coerceToAuthError)
      if (result.isErr()) {
        logger.warn(describeAuthError(result.error), 'send code failed')
        toast.show({
          variant: 'error',
          title: 'Could not send code',
          description: 'Check the address and try again.',
        })
        return false
      }
      setResendSeconds(RESEND_LOCKOUT_SECONDS)
      return true
    },
    [sendCode, toast],
  )

  const onContinueEmail = useCallback(async () => {
    if (!isValidEmail(email)) return
    setIsSending(true)
    const ok = await requestCode(email)
    setIsSending(false)
    if (ok) setPhase('otp')
  }, [email, requestCode])

  const onSubmitCode = useCallback(
    async (submitted: string) => {
      setIsVerifying(true)
      const result = await ResultAsync.fromPromise(
        loginWithCode({ code: submitted }),
        coerceToAuthError,
      )
      setIsVerifying(false)
      if (result.isErr()) {
        logger.warn(describeAuthError(result.error), 'verify code failed')
        toast.show({
          variant: 'error',
          title: 'Invalid or expired code',
          description: 'Request a new code and try again.',
        })
        setCode('')
      }
    },
    [loginWithCode, toast],
  )

  const onResend = useCallback(async () => {
    if (resendSeconds > 0) return
    setCode('')
    await requestCode(email)
  }, [resendSeconds, email, requestCode])

  const onBack = useCallback(() => {
    setCode('')
    setPhase('email')
  }, [])

  const emailFormatError = email !== '' && !isValidEmail(email) ? 'Enter a valid email address.' : null

  const emailView: EmailStepView = {
    kind: 'email',
    email,
    formatError: emailFormatError,
    canContinue: isValidEmail(email) && !isSending,
    isSending,
    onEmailChange: setEmail,
    onContinue: onContinueEmail,
  }

  const otpView: OtpStepView = {
    kind: 'otp',
    email,
    code,
    isVerifying: isVerifying || state.status === 'submitting-code',
    resendSeconds,
    canResend: resendSeconds === 0,
    onCodeChange: setCode,
    onSubmit: onSubmitCode,
    onResend,
    onBack,
  }

  return { phase, emailView, otpView }
}
