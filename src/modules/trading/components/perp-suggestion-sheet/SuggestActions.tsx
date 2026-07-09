import { PixelButton } from '@/modules/shared/components/pixel-button'
import { Callout } from '@/modules/shared/components/callout'
import {
  CHECKING_ACCESS_LABEL,
  ESTIMATE_LABEL,
  EXECUTE_LABEL,
  GRANT_ACCESS_LABEL,
  RE_ESTIMATE_LABEL,
  STALE_ESTIMATE_COPY,
} from './perp-suggestion-sheet.constants'
import styles from './perp-suggestion-sheet.module.css'
import type {
  EstimateState,
  SuggestActionsProps,
  SuggestionFailure,
} from './perp-suggestion-sheet.types'
import type { EstimateResult } from '../../api/suggestions.types'

/**
 * The estimate → execute controls (slice 09). Estimate prices the call; Execute
 * stays disabled until estimated + sufficient. Disconnected hides the
 * affordances (the header owns Connect); no delegation swaps Execute for "Grant
 * signingless access"; an insufficient quote leaves Execute disabled (the
 * persistent `SheetAgentBalance` footer owns the Top-Up affordance, slice 08).
 * Dumb — every handler + the gate come from the sheet hook.
 */
export function SuggestActions(props: SuggestActionsProps) {
  const { isConnected, estimate, execute } = props
  if (!isConnected) {
    return <p className={styles.hint}>Connect your wallet to ask an agent.</p>
  }

  const isEstimating = estimate.phase === 'loading'

  return (
    <div className={styles.actions} data-testid="suggest-actions">
      <PixelButton
        variant="default"
        fullWidth
        onClick={props.onEstimate}
        disabled={!props.canEstimate}
      >
        {isEstimating ? 'Estimating…' : ESTIMATE_LABEL}
      </PixelButton>

      {estimate.phase === 'error' ? (
        <FailureCallout label="Estimate failed" failure={estimate.error} />
      ) : null}

      {estimate.phase === 'ready' ? (
        <EstimateReadout estimate={estimate} ageLabel={props.estimateAgeLabel} />
      ) : null}

      {estimate.phase === 'ready' ? <ExecuteArea {...props} /> : null}

      {execute.phase === 'error' ? (
        <FailureCallout label={execute.error.title} failure={execute.error} />
      ) : null}
    </div>
  )
}

/**
 * A failure callout that surfaces the lead `detail` plus every per-issue line
 * (slice 06) when the server returned more than one — so multiple validation
 * reasons (a bad symbol AND an over-cap leverage) appear together, not just one.
 * A single-issue or transport failure shows only the lead line.
 */
function FailureCallout({
  label,
  failure,
}: {
  label: string
  failure: SuggestionFailure
}) {
  const hasMultipleIssues = failure.details.length > 1
  return (
    <Callout variant="error" label={label}>
      {hasMultipleIssues ? (
        <ul className={styles.issueList} data-testid="failure-issues">
          {failure.details.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        failure.detail
      )}
    </Callout>
  )
}

function EstimateReadout({
  estimate,
  ageLabel,
}: {
  estimate: Extract<EstimateState, { phase: 'ready' }>
  ageLabel: string | null
}) {
  const result: EstimateResult = estimate.result
  // The Agent Balance figure is NOT repeated here (slice 08): the persistent
  // footer (`SheetAgentBalance`) owns the always-visible balance, reconciled to
  // this quote's `agentBalanceUsd` while a quote is ready. Repeating it here
  // risked two on-screen numbers; the readout now carries only cost + sufficiency.
  return (
    <dl className={styles.readout} data-testid="estimate-readout">
      <div className={styles.readoutRow}>
        <dt>Cost</dt>
        <dd className={styles.costCell}>
          <span className={styles.mono}>${result.costUsd}</span>
          {ageLabel ? (
            <span className={styles.updatedAgo} data-testid="estimate-updated-ago">
              {ageLabel}
            </span>
          ) : null}
        </dd>
      </div>
      <div className={styles.readoutRow}>
        <dt>Sufficient</dt>
        <dd
          className={styles.sufficiency}
          data-sufficient={result.sufficient}
          data-testid="estimate-sufficient"
        >
          {result.sufficient ? 'Yes' : 'No'}
        </dd>
      </div>
    </dl>
  )
}

function ExecuteArea(props: SuggestActionsProps) {
  const { delegationGate, canExecute, estimate, isEstimateStale } = props
  const isReady = estimate.phase === 'ready'
  const isSufficient = isReady && estimate.result.sufficient

  // Delegation status is still resolving (slice 12): show an explicit, disabled
  // "Checking access…" beat instead of a silently-disabled Execute, so the gate
  // reads as in-progress rather than broken. Comes first — until resolved we
  // cannot know whether access needs granting.
  if (delegationGate === 'unknown') {
    return (
      <PixelButton variant="accentFilled" fullWidth disabled>
        {CHECKING_ACCESS_LABEL}
      </PixelButton>
    )
  }

  if (delegationGate === 'needs-grant') {
    return (
      <PixelButton variant="accent" fullWidth onClick={props.onGrantAccess}>
        {GRANT_ACCESS_LABEL}
      </PixelButton>
    )
  }

  // Staleness gate (slice 07): a quote older than the grace period swaps Execute
  // for an explicit, free Re-estimate — and takes precedence over sufficiency, so
  // even a sufficient-but-stale quote forces a re-estimate before executing.
  if (isEstimateStale) {
    return (
      <div className={styles.actions} data-testid="stale-estimate">
        <p className={styles.hint}>{STALE_ESTIMATE_COPY}</p>
        <PixelButton variant="accent" fullWidth onClick={props.onEstimate}>
          {RE_ESTIMATE_LABEL}
        </PixelButton>
      </div>
    )
  }

  // Insufficient: Execute stays disabled. The Top-Up affordance is NOT repeated
  // here (slice 08) — the persistent `SheetAgentBalance` footer owns it (same
  // `onTopUp` deposit path), surfaced whenever the ready quote is insufficient.
  if (!isSufficient) {
    return (
      <PixelButton variant="accentFilled" fullWidth disabled>
        {EXECUTE_LABEL}
      </PixelButton>
    )
  }

  return (
    <PixelButton
      variant="accentFilled"
      fullWidth
      onClick={props.onExecute}
      disabled={!canExecute}
    >
      {EXECUTE_LABEL}
    </PixelButton>
  )
}
