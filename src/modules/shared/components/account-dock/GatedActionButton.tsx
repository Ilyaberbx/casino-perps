import { useGatedActionButton } from './use-gated-action-button'
import styles from './gated-action-button.module.css'
import { IconButton } from '@/modules/shared/components/icon-button'
import type { GatedActionButtonProps } from './gated-action-button.types'

/**
 * Row-level action button (Cancel order, Close position) gated by the venue
 * `sign-actions` capability predicate. Renders the shared {@link IconButton}
 * (destructive tone) plus the gate affordances.
 *
 * When the predicate returns `true` (or the venue has no onboarding flow),
 * the button renders normally. When `false`, the button is disabled, the
 * desktop variant carries a hover tooltip + an info-icon next to it that
 * opens the venue-onboarding sheet, and the mobile variant opens the sheet
 * directly on tap (no hover tooltip on touch devices).
 */
export function GatedActionButton({
  icon,
  onClick,
  disabledTooltip,
  ariaLabel,
}: GatedActionButtonProps) {
  const { isReady, isMobile, handleButtonClick, handleInfoIconClick } =
    useGatedActionButton({ onClick })

  const isDisabledForGate = !isReady
  const tooltipForDesktop = isDisabledForGate && !isMobile ? disabledTooltip : undefined
  // The native `disabled` attribute would prevent the mobile tap-to-open-sheet
  // behaviour, so we keep the button interactive and use `aria-disabled` for
  // assistive-tech semantics instead.
  const showInfoIcon = isDisabledForGate && !isMobile
  // When enabled, expose the action name as a hover hint (icon-only button);
  // when disabled on desktop the wrap below carries the "complete setup" tooltip.
  const buttonTitle = isDisabledForGate ? undefined : ariaLabel

  return (
    <span className={styles.wrap} title={tooltipForDesktop}>
      <IconButton
        icon={icon}
        tone="destructive"
        elevated
        ariaLabel={ariaLabel}
        title={buttonTitle}
        onClick={handleButtonClick}
        aria-disabled={isDisabledForGate}
        data-disabled-gate={isDisabledForGate ? 'true' : undefined}
      />
      {showInfoIcon ? (
        <button
          type="button"
          className={styles.infoIcon}
          onClick={handleInfoIconClick}
          aria-label={disabledTooltip}
          data-testid="gated-action-info-icon"
        >
          i
        </button>
      ) : null}
    </span>
  )
}
