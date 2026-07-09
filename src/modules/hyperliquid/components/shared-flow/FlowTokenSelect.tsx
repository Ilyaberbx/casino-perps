import { PixelButton } from '@/modules/shared/components/pixel-button'
import { AssetIcon } from '@/modules/shared/components/asset-icon'
import { buildIconMarketFromSymbol } from '@/modules/shared/utils/resolve-market-icon-url'
import dropdownStyles from './flow-token-select.module.css'
import { useFlowTokenSelect } from './use-flow-token-select'
import type { FlowSelectableToken, FlowTokenSelectProps } from './shared-flow.types'

const ICON_SIZE = 18

/**
 * The asset picker: a custom accessible dropdown (button trigger + popover
 * listbox) so each option can render the token's icon + `{symbol} · {available}
 * available`. A native `<select>` can't show image icons in its options, which is
 * why this replaced it. Full keyboard support lives in `useFlowTokenSelect`
 * (Arrow keys move, Enter/Space select, Escape closes, focus returns to trigger);
 * `aria-activedescendant` keeps DOM focus on the trigger while announcing the
 * active option. The parent's hook owns the selection state. Shared by the send /
 * evm-core bodies — the per-flow `styles`, `idPrefix`, `label`, and `stateCopy`
 * are passed as props so the DOM + class hooks stay identical.
 *
 * Renders four states driven by `status`: `loading` / `error` (+ retry) / `empty`
 * (a friendly "no transferable assets" message) / `ready` (the dropdown) — never
 * a bare empty control.
 */
export function FlowTokenSelect<T extends FlowSelectableToken>({
  styles,
  idPrefix,
  label,
  tokens,
  selectedTokenKey,
  status,
  stateCopy,
  onSelect,
  onRetry,
}: FlowTokenSelectProps<T>) {
  const {
    isOpen,
    activeIndex,
    selectedIndex,
    listboxId,
    optionId,
    activeDescendantId,
    setTriggerRef,
    setWrapRef,
    setListboxRef,
    toggle,
    onTriggerKeyDown,
    onListboxKeyDown,
    onOptionPointerEnter,
    onOptionClick,
  } = useFlowTokenSelect<T>({ tokens, selectedTokenKey, idPrefix, onSelect })
  const triggerId = `${idPrefix}-token-trigger`
  const selectedToken = tokens[selectedIndex] ?? null

  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel} id={`${idPrefix}-token-label`}>
        {label}
      </span>

      {status === 'loading' && (
        <div className={dropdownStyles.stateBox} role="status" aria-live="polite">
          {stateCopy.loading}
        </div>
      )}

      {status === 'error' && (
        <div className={`${dropdownStyles.stateBox} ${dropdownStyles.stateError}`} role="alert">
          <span className={dropdownStyles.stateErrorText}>{stateCopy.error}</span>
          <PixelButton variant="default" size="sm" onClick={onRetry}>
            {stateCopy.errorRetry}
          </PixelButton>
        </div>
      )}

      {status === 'empty' && (
        <div className={dropdownStyles.stateBox} role="status">
          {stateCopy.empty}
        </div>
      )}

      {status === 'ready' && (
        <div className={dropdownStyles.wrap} ref={setWrapRef}>
          <button
            type="button"
            id={triggerId}
            ref={setTriggerRef}
            className={dropdownStyles.trigger}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-labelledby={`${idPrefix}-token-label ${triggerId}`}
            onClick={toggle}
            onKeyDown={onTriggerKeyDown}
          >
            <span className={dropdownStyles.triggerLabel}>
              {selectedToken !== null && (
                <AssetIcon market={buildIconMarketFromSymbol(selectedToken.symbol)} size={ICON_SIZE} />
              )}
              <span className={dropdownStyles.triggerSymbol}>{selectedToken?.symbol ?? ''}</span>
            </span>
            <span className={dropdownStyles.caret} aria-hidden="true">
              {isOpen ? '▲' : '▼'}
            </span>
          </button>

          {isOpen && (
            <ul
              role="listbox"
              id={listboxId}
              className={dropdownStyles.listbox}
              tabIndex={-1}
              aria-labelledby={`${idPrefix}-token-label`}
              aria-activedescendant={activeDescendantId}
              onKeyDown={onListboxKeyDown}
              ref={setListboxRef}
            >
              {tokens.map((token, index) => {
                const isActive = index === activeIndex
                const isSelected = token.key === selectedTokenKey
                const optionClass = [
                  dropdownStyles.option,
                  isActive ? dropdownStyles.optionActive : '',
                  isSelected ? dropdownStyles.optionSelected : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <li
                    key={token.key}
                    id={optionId(index)}
                    role="option"
                    aria-selected={isSelected}
                    className={optionClass}
                    onMouseEnter={() => onOptionPointerEnter(index)}
                    onClick={() => onOptionClick(index)}
                  >
                    <AssetIcon market={buildIconMarketFromSymbol(token.symbol)} size={ICON_SIZE} />
                    <span className={dropdownStyles.optionText}>
                      {token.symbol} <span className={dropdownStyles.optionAvailable}>· {token.available} available</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
