import styles from './deposit-flow.module.css'
import { DEPOSIT_COPY, DEPOSIT_STATUS_ROLE } from './deposit-flow.constants'
import { useDepositFlowBody } from './use-deposit-flow-body'
import { NeedsFundingTrack } from './NeedsFundingTrack'
import { WrongChainTrack } from './WrongChainTrack'
import { ReadyTrack } from './ReadyTrack'
import { SuccessTrack } from './SuccessTrack'
import { DepositErrorCallout } from './DepositErrorCallout'

/**
 * The dumb HL deposit body (the `body: FC` the venue exposes via
 * `VenueDepositCapability`). Renders exactly one track per machine phase; the
 * smart `useDepositFlowBody` hook owns all state. `aria-live="polite"` on the
 * region so a screen-reader hears the `checking → ready → sent → credited` and
 * error transitions non-visually (two-step legibility, brief a11y).
 */
export function DepositFlow() {
  const { flow, receiveAddress, close } = useDepositFlowBody()

  return (
    <div className={styles.body} role={DEPOSIT_STATUS_ROLE} aria-live="polite">
      <h2 className={styles.title}>{DEPOSIT_COPY.title}</h2>
      {renderTrack()}
    </div>
  )

  function renderTrack() {
    if (flow.phase === 'checking') {
      return <p className={styles.checking}>{DEPOSIT_COPY.checking}</p>
    }
    if (flow.phase === 'error' && flow.errorReason !== null) {
      return <DepositErrorCallout reason={flow.errorReason} onRetry={flow.retry} />
    }
    if (flow.phase === 'wrong-chain') {
      return <WrongChainTrack onSwitch={flow.switchChain} />
    }
    if (flow.phase === 'needs-funding') {
      if (receiveAddress === null) return <p className={styles.checking}>{DEPOSIT_COPY.checking}</p>
      return <NeedsFundingTrack address={receiveAddress} walletUsdc={flow.walletUsdc} />
    }
    if (flow.phase === 'sent' || flow.phase === 'credited') {
      return <SuccessTrack isCredited={flow.phase === 'credited'} onDone={close} />
    }
    // ready | no-gas | signing all share the amount track.
    return (
      <ReadyTrack
        amount={flow.amount}
        isAmountValid={flow.isAmountValid}
        amountInvalidReason={flow.amountInvalidReason}
        showGasWarning={flow.phase === 'no-gas'}
        isSigning={flow.phase === 'signing'}
        onAmountChange={flow.setAmount}
        onMax={flow.setAmountToMax}
        onSubmit={flow.submit}
      />
    )
  }
}
