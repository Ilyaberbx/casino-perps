import type { WatchlistTabProps } from './spectate-launcher.types'
import styles from './spectate-launcher.module.css'

export function WatchlistTab({
  rows,
  onSpectateEntry,
  onRemoveEntry,
  onStartEditLabel,
  onLabelDraftChange,
  onCommitLabel,
}: WatchlistTabProps) {
  const isEmpty = rows.length === 0

  if (isEmpty) {
    return (
      <p data-testid="watchlist-empty" className={styles.empty}>
        No saved addresses yet. Add one from the Enter address tab.
      </p>
    )
  }

  return (
    <ul className={styles.list} data-testid="watchlist-list">
      {rows.map((row) => (
        <li key={row.address} className={styles.row} data-testid="watchlist-row">
          {row.isEditing ? (
            <input
              className={styles.labelInput}
              data-testid="watchlist-label-input"
              type="text"
              autoFocus
              placeholder="Label"
              value={row.labelDraft}
              onChange={(e) => onLabelDraftChange(row.address, e.target.value)}
              onBlur={() => onCommitLabel(row.address)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCommitLabel(row.address)
              }}
            />
          ) : (
            <button
              type="button"
              className={styles.rowMain}
              data-testid="watchlist-spectate"
              title="Spectate this address"
              onClick={() => onSpectateEntry(row.address)}
            >
              {row.label !== undefined && row.label.length > 0 && (
                <span className={styles.rowLabel}>{row.label}</span>
              )}
              <span className={styles.rowAddress}>{row.displayAddress}</span>
            </button>
          )}
          <div className={styles.rowActions}>
            <button
              type="button"
              className={styles.iconButton}
              data-testid="watchlist-edit-label"
              aria-label="Edit label"
              title="Edit label"
              onClick={() => onStartEditLabel(row.address)}
            >
              ✎
            </button>
            <button
              type="button"
              className={styles.iconButton}
              data-testid="watchlist-remove"
              aria-label="Remove from watchlist"
              title="Remove from watchlist"
              onClick={() => onRemoveEntry(row.address)}
            >
              ✕
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
