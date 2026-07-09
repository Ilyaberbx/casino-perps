import { SegmentedControl } from '@/modules/shared/components/segmented-control'
import { PnlCardStepper } from './PnlCardStepper'
import styles from './pnl-card-modal.module.css'
import type {
  PnlCardArtTheme,
  PnlCardPickersProps,
  PnlHeroDisplay,
} from './pnl-card.types'

// Light before Dark, matching the natural on/off reading order.
const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const

const DISPLAY_OPTIONS = [
  { value: 'pct', label: '%' },
  { value: 'usd', label: '$' },
] as const

// The control cluster: mascot + planet arrow steppers, a Light/Dark art-theme
// toggle, and — only for full cards (`canToggle`) — the %↔$ hero toggle. Dumb:
// every piece of state and every handler comes from the modal hook via props.
export function PnlCardPickers({
  selection,
  planetLabel,
  mascotLabel,
  displayMode,
  canToggle,
  onStepPlanet,
  onStepMascot,
  onSetTheme,
  setDisplayMode,
}: PnlCardPickersProps) {
  return (
    <div className={styles.section}>
      <span className={styles.sectionLabel}>Style</span>
      <div className={styles.pickers}>
        <PnlCardStepper
          label="Mascot"
          value={mascotLabel}
          ariaLabel="Choose the card mascot"
          onStep={onStepMascot}
        />
        <PnlCardStepper
          label="Planet"
          value={planetLabel}
          ariaLabel="Choose the card planet"
          onStep={onStepPlanet}
        />
        <div className={styles.toggles}>
          <SegmentedControl<PnlCardArtTheme>
            options={THEME_OPTIONS}
            value={selection.theme}
            ariaLabel="Choose a light or dark card"
            onChange={onSetTheme}
          />
          {canToggle ? (
            <SegmentedControl<PnlHeroDisplay>
              options={DISPLAY_OPTIONS}
              value={displayMode}
              ariaLabel="Show PnL as percent or dollars"
              onChange={setDisplayMode}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
