import { DexSelector } from './DexSelector'
import { AgentPicker } from './AgentPicker'
import { AgentParamForm } from './AgentParamForm'
import { SuggestActions } from './SuggestActions'
import { SuggestStepper } from './SuggestStepper'
import { AgentWorkingLoader } from './AgentWorkingLoader'
import { SuggestPendingNotice } from './SuggestPendingNotice'
import { USE_CURRENT_MARKET_LABEL } from './perp-suggestion-sheet.constants'
import styles from './perp-suggestion-sheet.module.css'
import type { SuggestTabProps } from './perp-suggestion-sheet.types'

/**
 * The Suggest tab (slices 07–09): agent picker → dynamic param form →
 * estimate/execute controls, swapped for the agent-working loading beat while the
 * paid call runs. Dumb — all state + handlers come from the sheet hook (`vm`).
 */
export function SuggestTab({ vm }: SuggestTabProps) {
  const isExecuting = vm.execute.phase === 'loading'
  const isPending = vm.execute.phase === 'pending'
  const hasMarketField = vm.agent.fields.some((f) => f.kind === 'market')
  return (
    <div className={styles.tabBody}>
      <SuggestStepper steps={vm.steps} />
      <div className={styles.selectorRow}>
        <DexSelector
          options={vm.dexOptions}
          selectedVenueId={vm.selectedVenueId}
          onSelect={vm.selectVenue}
        />
        <AgentPicker
          agents={vm.agents}
          selectedAgentId={vm.selectedAgentId}
          onSelect={vm.selectAgent}
        />
      </div>
      <AgentParamForm agent={vm.agent} form={vm.paramForm} />
      {hasMarketField ? (
        <button
          type="button"
          className={styles.useCurrentMarket}
          onClick={vm.onUseCurrentMarket}
          data-testid="use-current-market"
        >
          {USE_CURRENT_MARKET_LABEL}
        </button>
      ) : null}
      {isPending ? (
        <SuggestPendingNotice
          iconKind={vm.agent.iconKind}
          animated={vm.loadingAnimated}
        />
      ) : isExecuting ? (
        <AgentWorkingLoader
          iconKind={vm.agent.iconKind}
          agentLabel={vm.agent.label}
          animated={vm.loadingAnimated}
        />
      ) : (
        <SuggestActions
          isConnected={vm.isConnected}
          estimate={vm.estimate}
          execute={vm.execute}
          canEstimate={vm.canEstimate}
          canExecute={vm.canExecute}
          isEstimateStale={vm.isEstimateStale}
          estimateAgeLabel={vm.estimateAgeLabel}
          delegationGate={vm.delegationGate}
          onEstimate={vm.onEstimate}
          onExecute={vm.onExecute}
          onGrantAccess={vm.onGrantAccess}
        />
      )}
    </div>
  )
}
