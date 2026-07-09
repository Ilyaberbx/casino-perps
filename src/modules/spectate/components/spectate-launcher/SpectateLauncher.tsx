import { Modal } from '@/modules/shared/components/modal'
import { useSpectateLauncher } from './use-spectate-launcher'
import { EnterAddressTab } from './EnterAddressTab'
import { WatchlistTab } from './WatchlistTab'
import type { SpectateLauncherProps } from './spectate-launcher.types'
import styles from './spectate-launcher.module.css'

export function SpectateLauncher({ isWalletConnected }: SpectateLauncherProps) {
  const {
    isOpen,
    activeTab,
    addressInput,
    error,
    canSubmit,
    watchlistRows,
    onOpen,
    onClose,
    onSelectTab,
    onAddressChange,
    onSubmit,
    onSaveToWatchlist,
    onSpectateEntry,
    onRemoveEntry,
    onStartEditLabel,
    onLabelDraftChange,
    onCommitLabel,
  } = useSpectateLauncher(isWalletConnected)

  const isEnterTab = activeTab === 'enter'

  return (
    <>
      <button
        type="button"
        data-testid="spectate-launcher-trigger"
        className={styles.trigger}
        aria-label="Spectate an address"
        title="Spectate an address"
        onClick={onOpen}
      >
        <span className={styles.triggerIcon} aria-hidden="true" />
      </button>
      <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Spectate" title="Spectate">
        <div className={styles.tabs} role="tablist" aria-label="Spectate tabs">
          <button
            type="button"
            role="tab"
            data-testid="spectate-tab-enter"
            aria-selected={isEnterTab}
            className={isEnterTab ? styles.tabActive : styles.tab}
            onClick={() => onSelectTab('enter')}
          >
            Enter address
          </button>
          <button
            type="button"
            role="tab"
            data-testid="spectate-tab-watchlist"
            aria-selected={!isEnterTab}
            className={!isEnterTab ? styles.tabActive : styles.tab}
            onClick={() => onSelectTab('watchlist')}
          >
            Watchlist
          </button>
        </div>
        {isEnterTab && (
          <EnterAddressTab
            addressInput={addressInput}
            error={error}
            canSubmit={canSubmit}
            onAddressChange={onAddressChange}
            onSubmit={onSubmit}
            onSaveToWatchlist={onSaveToWatchlist}
          />
        )}
        {!isEnterTab && (
          <WatchlistTab
            rows={watchlistRows}
            onSpectateEntry={onSpectateEntry}
            onRemoveEntry={onRemoveEntry}
            onStartEditLabel={onStartEditLabel}
            onLabelDraftChange={onLabelDraftChange}
            onCommitLabel={onCommitLabel}
          />
        )}
      </Modal>
    </>
  )
}
