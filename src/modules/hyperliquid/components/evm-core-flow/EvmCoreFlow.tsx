import { FlowErrorCallout } from '../shared-flow/FlowErrorCallout'
import styles from './evm-core-flow.module.css'
import {
  EVM_CORE_COPY,
  EVM_CORE_ERROR_LABEL,
  EVM_CORE_ERROR_PROSE,
  EVM_CORE_STATUS_ROLE,
} from './evm-core-flow.constants'
import { useEvmCoreFlowBody } from './use-evm-core-flow-body'
import { EvmCoreForm } from './EvmCoreForm'
import { EvmCoreReview } from './EvmCoreReview'
import { EvmCoreSuccess } from './EvmCoreSuccess'

/**
 * The dumb HL EVM⇄Core body (the `body: FC` the venue exposes via
 * `VenueEvmCoreCapability`). A two-step flow: `form` (direction + token + amount)
 * → `review` (read-only confirm + sign) → `sent` (instant ✓ + Done). On `error`
 * it swaps in an inline `EvmCoreErrorCallout` + retry (input preserved). The
 * smart `useEvmCoreFlowBody` hook owns all state. `aria-live="polite"` so a
 * screen-reader hears the phase transitions non-visually.
 */
export function EvmCoreFlow() {
  const { flow } = useEvmCoreFlowBody()

  const showError = flow.phase === 'error' && flow.errorReason !== null

  return (
    <div className={styles.body} role={EVM_CORE_STATUS_ROLE} aria-live="polite">
      <h2 className={styles.title}>{EVM_CORE_COPY.title}</h2>

      {showError && flow.errorReason !== null && (
        <FlowErrorCallout
          styles={styles}
          label={EVM_CORE_ERROR_LABEL}
          prose={EVM_CORE_ERROR_PROSE[flow.errorReason]}
          retryCta={EVM_CORE_COPY.retryCta}
          onRetry={flow.retry}
        />
      )}

      {flow.phase === 'form' && (
        <EvmCoreForm
          direction={flow.direction}
          tokens={flow.tokens}
          selectedTokenKey={flow.selectedTokenKey}
          symbol={flow.symbol}
          available={flow.available}
          amount={flow.amount}
          isAmountValid={flow.isAmountValid}
          amountInvalidReason={flow.amountInvalidReason}
          canReview={flow.canReview}
          evmPreflight={flow.evmPreflight}
          assetsStatus={flow.assetsStatus}
          onSelectDirection={flow.setDirection}
          onSelectToken={flow.selectToken}
          onRetryAssets={flow.retryAssets}
          onAmountChange={flow.setAmount}
          onMax={flow.setAmountToMax}
          onPercent={flow.setPercent}
          onSwitchChain={flow.switchChain}
          onReview={flow.review}
        />
      )}

      {(flow.phase === 'review' || flow.phase === 'signing') && (
        <EvmCoreReview
          direction={flow.direction}
          amount={flow.amount}
          symbol={flow.symbol}
          isSigning={flow.phase === 'signing'}
          onBack={flow.back}
          onSign={flow.submit}
        />
      )}

      {flow.phase === 'sent' && (
        <EvmCoreSuccess
          direction={flow.direction}
          amount={flow.amount}
          symbol={flow.symbol}
          explorerTxUrl={flow.explorerTxUrl}
          onDone={flow.reset}
        />
      )}
    </div>
  )
}
