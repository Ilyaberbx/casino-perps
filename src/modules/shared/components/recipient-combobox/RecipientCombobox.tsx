import { Avatar } from 'web3-avatar-react'
import { Popover } from '@/modules/shared/components/popover'
import styles from './recipient-combobox.module.css'
import { RECIPIENT_COMBOBOX } from './recipient-combobox.constants'
import type { RecipientComboboxView } from './recipient-combobox.types'

/**
 * A recipient-address field rendered as a combobox: a free-text `0x…` input (any
 * pasted address is still accepted) plus a suggestion dropdown grouped into the
 * user's own wallets and addresses they recently sent to. Dumb — all state and
 * handlers come from `useRecipientCombobox`. Owns the whole field (label + optional
 * hint + input + caret + dropdown + optional invalid message), so a host just drops
 * it where its destination field was. Rows carry a deterministic `web3-avatar`
 * identicon seeded from the address (square, to match the pixel-art system).
 */
export function RecipientCombobox({
  value,
  inputId,
  label,
  hint,
  ariaLabel,
  placeholder,
  isInvalid,
  invalidReason,
  isOpen,
  hasSuggestions,
  groups,
  activeOptionId,
  anchorRef,
  panelRef,
  onInputChange,
  onFocus,
  onToggle,
  onKeyDown,
  onSelect,
}: RecipientComboboxView) {
  const inputClass = isInvalid ? `${styles.input} ${styles.inputInvalid}` : styles.input

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
        {hint !== null && <span className={styles.hint}>{hint}</span>}
      </div>
      <div ref={anchorRef} className={styles.anchor}>
        <input
        id={inputId}
        className={inputClass}
        type="text"
        role="combobox"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={isInvalid}
        aria-expanded={isOpen}
        aria-controls={RECIPIENT_COMBOBOX.listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeOptionId ?? undefined}
        autoComplete="off"
        onFocus={onFocus}
        onChange={(event) => onInputChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      {hasSuggestions && (
        <button
          type="button"
          className={styles.toggle}
          tabIndex={-1}
          aria-label={RECIPIENT_COMBOBOX.toggleLabel}
          onClick={onToggle}
        >
          <span aria-hidden="true">▾</span>
        </button>
      )}

      {isOpen && (
        <Popover anchorRef={anchorRef} panelRef={panelRef} placement="bottom-start">
          <div
            ref={panelRef}
            id={RECIPIENT_COMBOBOX.listboxId}
            role="listbox"
            aria-label={RECIPIENT_COMBOBOX.suggestionsLabel}
            className={styles.panel}
          >
            {groups.map((group) => (
              <div
                key={group.heading}
                role="group"
                aria-label={group.heading}
                className={styles.group}
              >
                <div className={styles.heading}>{group.heading}</div>
                {group.options.map((option) => (
                  <button
                    key={option.id}
                    id={option.id}
                    type="button"
                    role="option"
                    aria-selected={option.isActive}
                    className={
                      option.isActive ? `${styles.option} ${styles.optionActive}` : styles.option
                    }
                    // Keep the input focused (so the activedescendant model holds)
                    // and let onClick own selection.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onSelect(option.address)}
                  >
                    <span
                      className={styles.avatar}
                      style={{
                        width: RECIPIENT_COMBOBOX.avatarSizePx,
                        height: RECIPIENT_COMBOBOX.avatarSizePx,
                      }}
                    >
                      <Avatar
                        address={option.address.toLowerCase()}
                        style={{
                          width: RECIPIENT_COMBOBOX.avatarSizePx,
                          height: RECIPIENT_COMBOBOX.avatarSizePx,
                          borderRadius: 0,
                        }}
                      />
                    </span>
                    <span className={styles.text}>
                      <span className={styles.title}>{option.title}</span>
                      {option.subtitle !== null && (
                        <span className={styles.sub}>{option.subtitle}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Popover>
      )}
      </div>
      {invalidReason !== null && (
        <span className={styles.invalid} role="alert">
          {invalidReason}
        </span>
      )}
    </div>
  )
}
