import type { ThemeVariant } from '@/modules/shared/providers/theme-provider'
import type { TradingMode } from '@/modules/shared/providers/trading-mode-provider'

export type HandleAvailability = 'idle' | 'checking' | 'available' | 'taken'

/** The last completed availability check, keyed to the handle it ran for. */
export interface HandleCheck {
  handle: string
  status: 'idle' | 'available' | 'taken'
}

export interface EmailStepView {
  kind: 'email'
  email: string
  formatError: string | null
  canContinue: boolean
  isSending: boolean
  onEmailChange: (next: string) => void
  onContinue: () => Promise<void>
}

export interface OtpStepView {
  kind: 'otp'
  email: string
  code: string
  isVerifying: boolean
  resendSeconds: number
  canResend: boolean
  onCodeChange: (next: string) => void
  onSubmit: (code: string) => Promise<void>
  onResend: () => Promise<void>
  onBack: () => void
}

export interface HandleStepView {
  kind: 'handle'
  handle: string
  formatError: string | null
  availability: HandleAvailability
  canContinue: boolean
  isSubmitting: boolean
  onHandleChange: (next: string) => void
  onContinue: () => Promise<void>
  // Invite-code gate (rendered only when `showInviteField`). `inviteError`
  // carries the inline server message for a bad/used code.
  showInviteField: boolean
  inviteCode: string
  inviteError: string | null
  onInviteCodeChange: (next: string) => void
}

export interface MfaStepView {
  kind: 'mfa'
  isEnrolling: boolean
  onSetup: () => Promise<void>
  onSkip: () => void
}

/** Final new-account step: pick the theme + mobile trading layout, then finish. */
export interface PersonalizeStepView {
  kind: 'personalize'
  theme: ThemeVariant
  onSelectTheme: (theme: ThemeVariant) => void
  tradingMode: TradingMode
  onSelectTradingMode: (mode: TradingMode) => void
  onDone: () => void
}

export type StepView =
  | EmailStepView
  | OtpStepView
  | HandleStepView
  | MfaStepView
  | PersonalizeStepView

export interface OnboardingStepperView {
  step: StepView
  stepNumber: number
  totalSteps: number
  onClose: () => void
}
