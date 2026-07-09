import { useCallback, useMemo, useState } from 'react'
import { useVenueOnboarding } from '../../providers/venue-onboarding-provider'
import { useVenueOnboardingSheet } from '../../providers/venue-onboarding-sheet-provider'
import { useVenueOnboardingSeenStoreOptional } from '../../providers/venue-onboarding-seen-store-provider'
import type { VenueOnboardingInputSpec, VenueOnboardingStep } from '../../domain'
import type {
  VenueOnboardingSheetContent,
  VenueOnboardingSheetHookOptions,
} from './venue-onboarding-sheet.types'
import {
  buildDefaultValues,
  collectInputs,
  findFirstIncompleteStep,
  pickPrimaryLabel,
} from './venue-onboarding-sheet.utils'

const EMPTY_STEPS: ReadonlyArray<VenueOnboardingStep> = []
const EMPTY_INPUTS: ReadonlyArray<VenueOnboardingInputSpec> = []

function emptyContent(): VenueOnboardingSheetContent {
  return {
    venueLabel: '',
    steps: EMPTY_STEPS,
    inputs: EMPTY_INPUTS,
    values: {},
    onValueChange: () => {},
    headline: '',
    isPrimaryDisabled: true,
    isPrimaryRunning: false,
    primaryLabel: 'Start setup',
    onPrimaryClick: () => {},
    onRetryStep: () => {},
    onResetLocalState: () => {},
    showMigrationNotice: false,
    onDismissMigrationNotice: () => {},
  }
}

export function useVenueOnboardingSheetContent(
  options: VenueOnboardingSheetHookOptions,
): VenueOnboardingSheetContent {
  const onboarding = useVenueOnboarding()
  // Touch the sheet provider so consumers get the expected runtime guard if
  // the smart hook is mounted outside the controller.
  useVenueOnboardingSheet()
  const [overrides, setOverrides] = useState<Record<string, string>>({})

  const isOnboardingPresent = onboarding !== null
  const steps = isOnboardingPresent ? onboarding.steps : EMPTY_STEPS
  const inputs = useMemo(() => collectInputs(steps), [steps])
  const defaults = useMemo(() => buildDefaultValues(inputs), [inputs])
  const values = useMemo<Record<string, string>>(
    () => ({ ...defaults, ...overrides }),
    [defaults, overrides],
  )

  const onValueChange = useCallback((id: string, value: string) => {
    setOverrides((prev) => ({ ...prev, [id]: value }))
  }, [])

  const seenStoreCtx = useVenueOnboardingSeenStoreOptional()

  const isAgentComplete = steps.some((s) => s.id === 'agent' && s.status === 'complete')
  const isBuilderComplete = steps.some((s) => s.id === 'builder' && s.status === 'complete')
  const isMigrationCandidate = isAgentComplete && !isBuilderComplete
  const hasSeenMigrationNotice = seenStoreCtx?.state.hasSeenMigrationNotice ?? false
  const isMigrationOverride = options.showMigrationNotice ?? false
  const isDerivedShowMigrationNotice = isMigrationCandidate && !hasSeenMigrationNotice
  const showMigrationNotice = isMigrationOverride || isDerivedShowMigrationNotice

  const onDismissMigrationNotice = useCallback(() => {
    seenStoreCtx?.markMigrationDismissed()
    options.onDismissMigrationNotice?.()
  }, [seenStoreCtx, options])

  const onRetryStep = useCallback(
    (stepId: string) => {
      if (!onboarding) return
      onboarding.retryStep(stepId, values)
    },
    [onboarding, values],
  )

  const onResetLocalState = useCallback(
    async (stepId: string) => {
      if (!onboarding) return
      const step = onboarding.steps.find((s) => s.id === stepId)
      if (!step) return
      const status = step.status
      const isErrorStatus = typeof status === 'object' && status.kind === 'error'
      if (!isErrorStatus) return
      if (status.cta.kind !== 'reset-local-state') return
      const confirmed = await options.actions.confirmReset(status.cta.confirmCopy)
      if (!confirmed) return
      onboarding.retryStep(stepId, values)
    },
    [onboarding, values, options.actions],
  )

  const onPrimaryClick = useCallback(() => {
    if (!onboarding) return
    onboarding.runAll(values)
  }, [onboarding, values])

  if (!isOnboardingPresent) {
    return emptyContent()
  }

  const { step: firstIncomplete } = findFirstIncompleteStep(steps)
  const hasAnyRunning = steps.some((s) => s.status === 'running')
  const isReady = onboarding.status === 'ready'

  const headline = `To start trading on ${onboarding.venueLabel}, you'll sign ${steps.length} requests from your master wallet:`
  const hasResumedProgress = firstIncomplete !== null && firstIncomplete !== steps[0]
  const primaryLabel = pickPrimaryLabel({ hasAnyRunning, hasResumedProgress })
  const isPrimaryDisabled = hasAnyRunning || isReady

  return {
    venueLabel: onboarding.venueLabel,
    steps,
    inputs,
    values,
    onValueChange,
    headline,
    isPrimaryDisabled,
    isPrimaryRunning: hasAnyRunning,
    primaryLabel,
    onPrimaryClick,
    onRetryStep,
    onResetLocalState: (stepId: string) => {
      void onResetLocalState(stepId)
    },
    showMigrationNotice,
    onDismissMigrationNotice,
  }
}
