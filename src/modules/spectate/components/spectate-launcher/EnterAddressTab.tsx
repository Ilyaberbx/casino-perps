import type { EnterAddressTabProps } from './spectate-launcher.types'
import styles from './spectate-launcher.module.css'

export function EnterAddressTab({
  addressInput,
  error,
  canSubmit,
  onAddressChange,
  onSubmit,
  onSaveToWatchlist,
}: EnterAddressTabProps) {
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <label className={styles.label} htmlFor="spectate-address-input">
        Wallet address
      </label>
      <input
        id="spectate-address-input"
        data-testid="spectate-address-input"
        className={styles.input}
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        placeholder="0x…"
        value={addressInput}
        aria-invalid={error !== null}
        onChange={(e) => onAddressChange(e.target.value)}
      />
      {error !== null && (
        <p role="alert" data-testid="spectate-address-error" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button
          type="submit"
          data-testid="spectate-submit"
          className={styles.submit}
          disabled={!canSubmit}
        >
          Start spectating
        </button>
        <button
          type="button"
          data-testid="spectate-save-to-watchlist"
          className={styles.secondary}
          disabled={!canSubmit}
          onClick={onSaveToWatchlist}
        >
          Save to watchlist
        </button>
      </div>
    </form>
  )
}
