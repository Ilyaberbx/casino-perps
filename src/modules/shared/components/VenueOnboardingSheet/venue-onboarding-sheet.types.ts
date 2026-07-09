import type {
  VenueOnboardingErrorCta,
  VenueOnboardingInputSpec,
  VenueOnboardingStep,
  VenueOnboardingStepCapability,
  VenueOnboardingStepStatus,
} from '../../domain'

/**
 * Action callbacks the sheet asks of its host for CTA kinds that require app-
 * level helpers the shared module cannot reach (wallet, network). The host
 * (e.g. `app/`) wires them; tests pass mocks. See ADR-0026.
 */
export interface VenueOnboardingSheetActions {
  reconnectWallet(): void
  switchChain(targetChainId: number): Promise<void> | void
  reload(): void
  /** Confirm the destructive `reset-local-state` action; UI asks the user. */
  confirmReset(message: string): Promise<boolean> | boolean
  /**
   * Open the in-app deposit sheet (the `open-deposit` CTA). The host closes the
   * onboarding sheet and opens the sibling deposit sheet so the two never stack.
   */
  openDeposit(): void
}

export interface VenueOnboardingSheetProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly venueLogoUrl?: string
  readonly showMigrationNotice?: boolean
  readonly onDismissMigrationNotice?: () => void
  readonly actions: VenueOnboardingSheetActions
}

export interface StepIconProps {
  readonly index: number
  readonly status: VenueOnboardingStepStatus
}

export interface ErrorSubCardProps {
  readonly stepId: string
  readonly status: Extract<VenueOnboardingStepStatus, { kind: 'error' }>
  readonly actions: VenueOnboardingSheetActions
  readonly onRetry: (stepId: string) => void
  readonly onResetLocalState: (stepId: string) => void
}

export interface StepRowProps {
  readonly step: VenueOnboardingStep
  readonly index: number
  readonly actions: VenueOnboardingSheetActions
  readonly onRetry: (stepId: string) => void
  readonly onResetLocalState: (stepId: string) => void
}

export interface MigrationNoticeProps {
  readonly onDismiss: () => void
}

export interface InputFormProps {
  readonly inputs: ReadonlyArray<VenueOnboardingInputSpec>
  readonly values: Readonly<Record<string, string>>
  readonly onValueChange: (id: string, value: string) => void
}

export interface VenueOnboardingSheetHookOptions {
  readonly actions: VenueOnboardingSheetActions
  readonly showMigrationNotice?: boolean
  readonly onDismissMigrationNotice?: () => void
}

export interface VenueOnboardingSheetContent {
  readonly venueLabel: string
  readonly steps: ReadonlyArray<VenueOnboardingStep>
  readonly inputs: ReadonlyArray<VenueOnboardingInputSpec>
  readonly values: Readonly<Record<string, string>>
  readonly onValueChange: (id: string, value: string) => void
  readonly headline: string
  readonly isPrimaryDisabled: boolean
  readonly isPrimaryRunning: boolean
  readonly primaryLabel: string
  readonly onPrimaryClick: () => void
  readonly onRetryStep: (stepId: string) => void
  readonly onResetLocalState: (stepId: string) => void
  readonly showMigrationNotice: boolean
  readonly onDismissMigrationNotice: () => void
}

export type VenueOnboardingSheetCapabilityFilter = VenueOnboardingStepCapability | 'all'

export interface ResolvedActionButton {
  readonly kind: 'button'
  readonly label: string
  readonly onClick: () => void
}

export interface ResolvedActionLink {
  readonly kind: 'link'
  readonly label: string
  readonly href: string
}

export type ResolvedAction = ResolvedActionButton | ResolvedActionLink

export interface FieldRendererProps {
  readonly spec: VenueOnboardingInputSpec
  readonly values: Readonly<Record<string, string>>
  readonly onValueChange: (id: string, value: string) => void
}

export type { VenueOnboardingErrorCta }
