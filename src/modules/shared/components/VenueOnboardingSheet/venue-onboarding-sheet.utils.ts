import type {
  VenueOnboardingErrorCta,
  VenueOnboardingInputSpec,
  VenueOnboardingStep,
} from '../../domain'
import type {
  ResolvedAction,
  VenueOnboardingSheetActions,
} from './venue-onboarding-sheet.types'

export function collectInputs(
  steps: ReadonlyArray<VenueOnboardingStep>,
): ReadonlyArray<VenueOnboardingInputSpec> {
  const out: VenueOnboardingInputSpec[] = []
  for (const step of steps) {
    if (!step.inputs) continue
    for (const input of step.inputs) out.push(input)
  }
  return out
}

export function buildDefaultValues(
  inputs: ReadonlyArray<VenueOnboardingInputSpec>,
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const input of inputs) {
    if (input.kind === 'text') out[input.id] = input.defaultValue ?? ''
    if (input.kind === 'select') out[input.id] = input.options[0]?.value ?? ''
    if (input.kind === 'checkbox') out[input.id] = 'false'
  }
  return out
}

export interface FirstIncompleteStepResult {
  readonly step: VenueOnboardingStep | null
}

export function findFirstIncompleteStep(
  steps: ReadonlyArray<VenueOnboardingStep>,
): FirstIncompleteStepResult {
  for (const step of steps) {
    if (step.status === 'complete') continue
    return { step }
  }
  return { step: null }
}

export function pickPrimaryLabel(input: {
  readonly hasAnyRunning: boolean
  readonly hasResumedProgress: boolean
}): string {
  if (input.hasAnyRunning) return 'Signing…'
  if (input.hasResumedProgress) return 'Continue setup'
  return 'Start setup'
}

export function resolveCta(
  cta: VenueOnboardingErrorCta,
  stepId: string,
  actions: VenueOnboardingSheetActions,
  onRetry: (stepId: string) => void,
  onResetLocalState: (stepId: string) => void,
): ResolvedAction {
  if (cta.kind === 'retry') {
    return { kind: 'button', label: cta.label ?? 'Try again', onClick: () => onRetry(stepId) }
  }

  if (cta.kind === 'external-link') {
    return { kind: 'link', label: cta.label, href: cta.href }
  }

  if (cta.kind === 'open-deposit') {
    return { kind: 'button', label: cta.label, onClick: actions.openDeposit }
  }

  if (cta.kind === 'switch-network') {
    const switchChainAndRetry = async () => {
      await actions.switchChain(cta.targetChainId)
      onRetry(stepId)
    }
    return {
      kind: 'button',
      label: `Switch to ${cta.chainName}`,
      onClick: () => {
        void switchChainAndRetry()
      },
    }
  }

  if (cta.kind === 'reconnect-wallet') {
    return {
      kind: 'button',
      label: 'Reconnect wallet',
      onClick: actions.reconnectWallet,
    }
  }

  if (cta.kind === 'reset-local-state') {
    return {
      kind: 'button',
      label: cta.confirmCopy,
      onClick: () => onResetLocalState(stepId),
    }
  }

  return { kind: 'button', label: 'Reload page', onClick: actions.reload }
}

