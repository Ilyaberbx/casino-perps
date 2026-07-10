import { useCallback, useMemo, useRef } from 'react'
import type {
  VenueOnboardingInputSpec,
  VenueOnboardingStep,
} from '@/modules/shared/domain/venue-onboarding'
import { parseWalletAddress, type WalletAddress } from '@/modules/shared/domain'
import { useAuth, useIsWalletConnected, useSelectedWallet } from '@/modules/account'
import { HYPERLIQUID_VENUE_ID, HYPERLIQUID_VENUE_LABEL } from '../../hyperliquid.constants'
import {
  HYPERLIQUID_AGENT_NAME_INPUT_ID,
  HYPERLIQUID_REPLACE_AGENT_INPUT_ID,
  HYPERLIQUID_REVOKE_BUILDER_INPUT_ID,
  HYPERLIQUID_STEP_AGENT_ID,
  HYPERLIQUID_STEP_BUILDER_ID,
  HYPERLIQUID_STEP_DEPOSIT_ID,
  type HyperliquidVenueOnboarding,
} from './hyperliquid-onboarding-provider.types'
import type { AgentWalletState } from '../agent-wallet-provider/agent-wallet-provider.context'
import type { BuilderFeeState } from '../builder-fee-provider/builder-fee-provider.context'
import type { DepositState } from '../deposit-provider/deposit-provider.context'
import { deriveDefaultAgentName } from '../../hyperliquid.utils'
import {
  buildAgentReplaceSelect,
  buildBuilderRevokeSelect,
  composeStatus,
  isAgentSlotsFullStatus,
  isBuilderCapStatus,
  projectAgentStepStatus,
  projectBuilderStepStatus,
  projectDepositStepStatus,
} from './hyperliquid-onboarding.utils'
import { useOnboardingLegs } from './use-onboarding-legs'
import { useOnboardingRunAll } from './use-onboarding-run-all'
import { useOnboardingRetryStep } from './use-onboarding-retry-step'

const AGENT_NAME_MIN_LENGTH = 1
const AGENT_NAME_MAX_LENGTH = 16

export interface UseOwnHyperliquidVenueOnboardingOptions {
  readonly agent: AgentWalletState
  readonly builder: BuilderFeeState
  readonly deposit: DepositState
}

/**
 * Smart hook for the Hyperliquid onboarding port. Composes the
 * deposit-provider + agent-wallet + builder-fee provider states and exposes
 * them via the venue-agnostic `VenueOnboarding` surface.
 *
 * Must be mounted INSIDE `<DepositProvider>`, `<AgentWalletProvider>`, and
 * `<BuilderFeeProvider>` (all three are required).
 *
 * Decisions captured here:
 * - Steps are ordered: deposit (step-0, capability-less) → agent → builder.
 * - Deposit step projects 'needs-deposit' to an error-status carrying the in-app
 *   open-deposit CTA (HIGH-1: StepRow renders a CTA only inside an error
 *   sub-card; a plain 'pending' would show NO deposit affordance).
 * - Venue status machine: `bootstrapping` → `incomplete` → `ready`.
 *   Never emits a blocked-kind venue status (D-10) — that would suppress the
 *   auto-open the never-funded user depends on.
 * - `runAll` gates on deposit complete before agent/builder (T-07-11).
 * - `retryStep('deposit')` calls deposit.recheck() — no signing (D-7 / Pitfall 4).
 * - `runAll` and `retryStep` are guarded by `_isRunning` to prevent double-clicks.
 */
export function useOwnHyperliquidVenueOnboarding(
  options: UseOwnHyperliquidVenueOnboardingOptions,
): HyperliquidVenueOnboarding {
  const { agent, builder, deposit } = options
  const { primaryWalletAddress } = useAuth()
  const { nativeAddress } = useSelectedWallet()
  const isWalletConnected = useIsWalletConnected()
  const isRunningRef = useRef(false)

  const hasPrimaryWallet = primaryWalletAddress !== null
  const isSessionLive = isWalletConnected && hasPrimaryWallet

  // ADR-0061: the default agent name is account-stable — keyed on the Native
  // (embedded) wallet, NOT the selected master — so it matches the bootstrap's
  // `expectedAgentName` (`deriveDefaultAgentName(nativeAddress)`) and re-approving
  // against the same master reuses the same named slot (replaces, never proliferates).
  const defaultAgentName = useMemo(
    () => deriveDefaultAgentName(nativeAddress),
    [nativeAddress],
  )

  const depositStepStatus = projectDepositStepStatus(deposit.status)
  const agentStepStatus = projectAgentStepStatus(agent.status)
  const builderStepStatus = projectBuilderStepStatus(builder.status)

  // ADR-0036 D-3: in the slots-full state the victim picker REPLACES the name
  // input — the replacement approve must re-use the chosen agent's exact name,
  // so a free-form label would be ignored and only mislead. Falls back to the
  // text input while the agent list is still loading.
  const hasAgentVictims = agent.existingAgents !== null && agent.existingAgents.length > 0
  const showAgentReplacePicker = isAgentSlotsFullStatus(agent.status) && hasAgentVictims
  const agentStepInputs = useMemo<ReadonlyArray<VenueOnboardingInputSpec>>(() => {
    if (showAgentReplacePicker && agent.existingAgents !== null) {
      return [buildAgentReplaceSelect(agent.existingAgents)]
    }
    return [
      {
        kind: 'text',
        id: HYPERLIQUID_AGENT_NAME_INPUT_ID,
        label: 'Table name',
        minLength: AGENT_NAME_MIN_LENGTH,
        maxLength: AGENT_NAME_MAX_LENGTH,
        defaultValue: defaultAgentName,
      },
    ]
  }, [showAgentReplacePicker, agent.existingAgents, defaultAgentName])

  // ADR-0036 D-4: the revoke picker renders only in the cap-rejected state,
  // once the lazily-fetched builder list has landed.
  const hasBuilderVictims = builder.approvedBuilders !== null && builder.approvedBuilders.length > 0
  const showBuilderRevokePicker = isBuilderCapStatus(builder.status) && hasBuilderVictims
  const builderStepInputs = useMemo<ReadonlyArray<VenueOnboardingInputSpec> | undefined>(() => {
    if (showBuilderRevokePicker && builder.approvedBuilders !== null) {
      return [buildBuilderRevokeSelect(builder.approvedBuilders)]
    }
    return undefined
  }, [showBuilderRevokePicker, builder.approvedBuilders])

  const steps = useMemo<ReadonlyArray<VenueOnboardingStep>>(
    () => [
      // Step 0 — deposit (capability-less; D-9). No `capability` key, no `inputs`.
      // needs-deposit projects to an error-status so StepRow renders the open-deposit CTA (HIGH-1).
      {
        id: HYPERLIQUID_STEP_DEPOSIT_ID,
        label: 'Add cash',
        description: 'Add cash before you can place bets.',
        status: depositStepStatus,
      },
      {
        id: HYPERLIQUID_STEP_AGENT_ID,
        label: 'Set up your table',
        description: 'Gets your table ready to place bets. Kept in your browser.',
        capability: 'sign-actions',
        status: agentStepStatus,
        inputs: agentStepInputs,
      },
      {
        id: HYPERLIQUID_STEP_BUILDER_ID,
        label: 'Builder fee',
        description: 'Authorizes a 3.5 bps fee on fills routed through us.',
        capability: 'route-fees',
        status: builderStepStatus,
        inputs: builderStepInputs,
      },
    ],
    [depositStepStatus, agentStepStatus, builderStepStatus, agentStepInputs, builderStepInputs],
  )

  // Bootstrap heuristic: the venue stays `bootstrapping` until the wallet is
  // usable for trading AND all three step providers have settled their initial
  // read. The second clause is load-bearing: on reload the deposit/agent/builder
  // bootstrap queries resolve asynchronously and independently, so without it the
  // venue would report a transient `incomplete` the instant the session goes live
  // — flickering the progress badge 0/3→3/3 and firing a false "setup complete"
  // toast on the bogus `incomplete → ready` edge. While any step is still
  // `'checking'` we suppress that window; an already-onboarded reload then
  // transitions `bootstrapping → ready` directly. `'checking'` is the initial
  // state only — an active `runAll` uses `'approving'`, never `'checking'`.
  const isDepositChecking = deposit.status === 'checking'
  const isAgentChecking = agent.status === 'checking'
  const isBuilderChecking = builder.status === 'checking'
  const isAnyInitialCheckPending = isDepositChecking || isAgentChecking || isBuilderChecking

  const isBootstrapping = !isSessionLive || isAnyInitialCheckPending
  const status = composeStatus(depositStepStatus, agentStepStatus, builderStepStatus, isBootstrapping)

  const resolveAgentName = useCallback(
    (values: Readonly<Record<string, string>>): string => {
      // ADR-0036 D-3: the victim-picker value wins — replacement requires the
      // existing agent's exact name, so it must shadow any free-form label.
      const victimName = values[HYPERLIQUID_REPLACE_AGENT_INPUT_ID]
      const hasVictimName = victimName !== undefined && victimName !== ''
      const isReplacing = showAgentReplacePicker && hasVictimName
      if (isReplacing && victimName !== undefined) return victimName

      const supplied = values[HYPERLIQUID_AGENT_NAME_INPUT_ID]
      const hasSuppliedName = supplied !== undefined && supplied !== ''
      if (hasSuppliedName) return supplied
      return defaultAgentName
    },
    [defaultAgentName, showAgentReplacePicker],
  )

  // ADR-0036 D-4: a parsable victim address routes the builder leg through the
  // revoke→approve chain; otherwise the plain approve runs. Only honoured while
  // the picker is actually showing — a stale select override from a previous
  // error state must not trigger a surprise revoke.
  const resolveBuilderVictim = useCallback(
    (values: Readonly<Record<string, string>>): WalletAddress | null => {
      if (!showBuilderRevokePicker) return null
      const supplied = values[HYPERLIQUID_REVOKE_BUILDER_INPUT_ID]
      if (supplied === undefined) return null
      const parsed = parseWalletAddress(supplied)
      return parsed.isOk() ? parsed.value : null
    },
    [showBuilderRevokePicker],
  )

  const legs = useOnboardingLegs(isRunningRef, agent.approve, builder.approve, builder.replaceBuilder)

  const runAll = useOnboardingRunAll({
    isRunningRef,
    depositStepStatus,
    agentStepStatus,
    builderStepStatus,
    legs,
    resolveAgentName,
    resolveBuilderVictim,
  })

  const retryStep = useOnboardingRetryStep({
    isRunningRef,
    depositRecheck: deposit.recheck,
    legs,
    resolveAgentName,
    resolveBuilderVictim,
  })

  return useMemo<HyperliquidVenueOnboarding>(
    () => ({
      venueId: HYPERLIQUID_VENUE_ID,
      venueLabel: HYPERLIQUID_VENUE_LABEL,
      status,
      steps,
      runAll,
      retryStep,
    }),
    [status, steps, runAll, retryStep],
  )
}
