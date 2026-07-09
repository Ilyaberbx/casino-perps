import { AmountInput } from '@/modules/shared/components/amount-input'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import { FlowTokenSelect } from '../shared-flow/FlowTokenSelect'
import { FlowPercentChips } from '@/modules/shared/components/flow-percent-chips'
import styles from './evm-core-flow.module.css'
import {
  EVM_CORE_ASSET_STATE_COPY,
  EVM_CORE_COPY,
  EVM_CORE_DESTINATION_VALUE,
  EVM_CORE_INTERNAL_NOTE,
  EVM_CORE_PERCENT_CHIPS,
} from './evm-core-flow.constants'
import { EvmCoreDirectionToggle } from './EvmCoreDirectionToggle'
import { EvmCorePreflightNotice } from './EvmCorePreflightNotice'
import type { EvmCoreFormProps } from './evm-core-flow.types'

/**
 * The `form` step: a direction toggle, then either the EVM preflight gate
 * (EVM→Core only, until the chain/gas/balance reads resolve to `ready`) or the
 * move form — a token picker, an amount input + percent chips, an "Available: N
 * SYMBOL" line, a summary (you move / destination = the user's own account on the
 * other side — no recipient field), and the "Review transfer" CTA.
 */
export function EvmCoreForm(props: EvmCoreFormProps) {
  const isEvmToCore = props.direction === 'evm-to-core'
  const isPreflightGated = isEvmToCore && props.evmPreflight !== 'ready'
  const areAssetsReady = props.assetsStatus === 'ready'

  return (
    <div className={styles.track}>
      <EvmCoreDirectionToggle direction={props.direction} onSelect={props.onSelectDirection} />

      {isPreflightGated && (
        <EvmCorePreflightNotice status={props.evmPreflight} onSwitchChain={props.onSwitchChain} />
      )}

      {!isPreflightGated && (
        <>
          <FlowTokenSelect
            styles={styles}
            idPrefix="evm-core"
            label={EVM_CORE_COPY.tokenLabel}
            tokens={props.tokens}
            selectedTokenKey={props.selectedTokenKey}
            status={props.assetsStatus}
            stateCopy={EVM_CORE_ASSET_STATE_COPY}
            onSelect={props.onSelectToken}
            onRetry={props.onRetryAssets}
          />

          {areAssetsReady && (
            <>
          <AmountInput
            label={EVM_CORE_COPY.amountLabel}
            value={props.amount}
            onChange={props.onAmountChange}
            isValid={props.isAmountValid}
            invalidReason={props.amountInvalidReason ?? undefined}
            unit={props.symbol}
            onMax={props.onMax}
          />
          <FlowPercentChips
            styles={styles}
            chips={EVM_CORE_PERCENT_CHIPS}
            disabled={false}
            onPercent={props.onPercent}
          />
          <p className={styles.availableLine}>
            {EVM_CORE_COPY.availablePrefix}{' '}
            <span className={styles.availableValue}>
              {props.available} {props.symbol}
            </span>
          </p>

          <div className={styles.summary}>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>{EVM_CORE_COPY.youMoveLabel}</span>
              <span className={styles.summaryValue}>
                {props.amount === '' ? '—' : props.amount} {props.symbol}
              </span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>{EVM_CORE_COPY.destinationRowLabel}</span>
              <span className={styles.summaryValue}>
                {EVM_CORE_DESTINATION_VALUE[props.direction]}
              </span>
            </div>
            <p className={styles.summaryNote}>{EVM_CORE_INTERNAL_NOTE[props.direction]}</p>
          </div>

          <PixelButton
            variant="accentFilled"
            fullWidth
            disabled={!props.canReview}
            onClick={props.onReview}
          >
            {EVM_CORE_COPY.reviewCta}
          </PixelButton>
            </>
          )}
        </>
      )}
    </div>
  )
}
