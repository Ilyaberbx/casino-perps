import { ConnectWalletGateButton } from '@/modules/account'
import styles from './delegation-consent.module.css'
import { delegationErrorCopy } from '../../agent-balance.utils'
import { TtlPresetChips } from './TtlPresetChips'
import {
  useDelegationConsent,
  type DelegationConsentDeps,
} from './use-delegation-consent'

/**
 * Dumb consent body for the scoped, revocable delegation (issue #205). When
 * active it renders the *granted* scope (recipient / cap / expiry) read-only and
 * offers a revoke. Otherwise it lets the User configure the grant — a USDC cap
 * input + a TTL preset chip — and offers a one-time grant. All state lives in
 * `useDelegationConsent`; this body renders its output and forwards events. No
 * `useState`/`useEffect` of its own.
 */
export function DelegationConsent(deps: DelegationConsentDeps) {
  const vm = useDelegationConsent(deps)

  return (
    <div className={styles.consent} aria-label="Agent signing delegation">
      <p className={styles.lead}>
        Grant a scoped, popup-free signer so your agent can pay Minara without a
        prompt each time. Limited to USDC, this recipient only, with a cap and
        expiry — it can never move funds to any other address.
      </p>

      {vm.isActive ? (
        <dl className={styles.scope}>
          <div className={styles.scopeRow}>
            <dt className={styles.scopeLabel}>Recipient</dt>
            <dd className={styles.scopeValue}>{vm.scope.recipient}</dd>
          </div>
          <div className={styles.scopeRow}>
            <dt className={styles.scopeLabel}>Cap</dt>
            <dd className={styles.scopeValue}>{vm.scope.cap}</dd>
          </div>
          <div className={styles.scopeRow}>
            <dt className={styles.scopeLabel}>Expires</dt>
            <dd className={styles.scopeValue}>{vm.scope.expiry}</dd>
          </div>
        </dl>
      ) : (
        <div className={styles.scope}>
          <div className={styles.scopeRow}>
            <span className={styles.scopeLabel}>Recipient</span>
            <span className={styles.scopeValue}>{vm.scope.recipient}</span>
          </div>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Cap (USDC)</span>
            <input
              className={styles.input}
              inputMode="decimal"
              placeholder="0.00"
              aria-label="Delegation spending cap in USDC"
              value={vm.capUsd}
              onChange={(event) => vm.setCapUsd(event.target.value)}
            />
            {vm.capInvalidReason !== null && vm.capUsd !== '' ? (
              <span className={styles.invalid} role="alert">
                {vm.capInvalidReason}
              </span>
            ) : null}
          </label>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Expires in</span>
            <TtlPresetChips
              presets={vm.ttlPresets}
              selected={vm.ttlDays}
              onSelect={vm.setTtlDays}
            />
            <span className={styles.expiryHint}>Expires {vm.scope.expiry}</span>
          </div>
        </div>
      )}

      <p className={styles.status} role="status">
        Status: <span className={styles.statusValue}>{vm.status}</span>
      </p>

      {vm.errorReason !== null ? (
        <span className={styles.invalid} role="alert">
          {delegationErrorCopy(vm.errorReason)}
        </span>
      ) : null}

      <ConnectWalletGateButton>
        {vm.isActive ? (
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={vm.phase === 'revoking'}
            onClick={vm.revoke}
          >
            {vm.phase === 'revoking' ? 'Revoking…' : 'Revoke delegation'}
          </button>
        ) : (
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!vm.canGrant || vm.phase === 'granting' || vm.phase === 'loading'}
            onClick={vm.grant}
          >
            {vm.phase === 'granting' ? 'Awaiting consent…' : 'Grant delegation'}
          </button>
        )}
      </ConnectWalletGateButton>
    </div>
  )
}
