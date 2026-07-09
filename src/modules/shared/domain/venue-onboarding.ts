import type { ResultAsync } from 'neverthrow'

export type VenueOnboardingStepCapability = 'sign-actions' | 'route-fees'

export type VenueOnboardingErrorCta =
  // `label` overrides the default "Try again" button text — used when the retry
  // is semantically more than a retry (e.g. "Replace agent", ADR-0036 D-5).
  | { kind: 'retry'; label?: string }
  | { kind: 'external-link'; href: string; label: string }
  | { kind: 'switch-network'; targetChainId: number; chainName: string }
  | { kind: 'reconnect-wallet' }
  | { kind: 'reset-local-state'; confirmCopy: string }
  | { kind: 'reload-page' }
  // Opens the in-app deposit sheet (the shared `deposit-sheet-provider`'s
  // `open()`), threaded as a host action. Used by the first-deposit step so
  // funding happens inside the app rather than handing off to app.hyperliquid.xyz.
  | { kind: 'open-deposit'; label: string }

export type VenueOnboardingInputSpec =
  | {
      kind: 'text'
      id: string
      label: string
      placeholder?: string
      minLength: number
      maxLength: number
      defaultValue?: string
    }
  | {
      kind: 'select'
      id: string
      label: string
      options: ReadonlyArray<{ value: string; label: string }>
    }
  | {
      kind: 'checkbox'
      id: string
      label: string
      required: boolean
    }

export interface VenueOnboardingStepErrorStatus {
  readonly kind: 'error'
  readonly reason: string
  readonly headline: string
  readonly copy: string
  readonly cta: VenueOnboardingErrorCta
  readonly causeChain?: string
}

export type VenueOnboardingStepStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | VenueOnboardingStepErrorStatus

export interface VenueOnboardingStep {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly status: VenueOnboardingStepStatus
  readonly inputs?: ReadonlyArray<VenueOnboardingInputSpec>
  readonly capability?: VenueOnboardingStepCapability
}

export interface VenueOnboardingBlockedStatus {
  readonly kind: 'blocked'
  readonly reason: string
}

export type VenueOnboardingStatus =
  | 'idle'
  | 'bootstrapping'
  | 'incomplete'
  | 'ready'
  | VenueOnboardingBlockedStatus

export class VenueOnboardingError extends Error {
  readonly stepId: string
  readonly reason: string
  constructor(stepId: string, reason: string, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'VenueOnboardingError'
    this.stepId = stepId
    this.reason = reason
  }
}

export interface VenueOnboarding {
  readonly venueId: string
  readonly venueLabel: string
  readonly status: VenueOnboardingStatus
  readonly steps: ReadonlyArray<VenueOnboardingStep>
  runAll(values: Readonly<Record<string, string>>): ResultAsync<void, VenueOnboardingError>
  retryStep(
    stepId: string,
    values: Readonly<Record<string, string>>,
  ): ResultAsync<void, VenueOnboardingError>
}
