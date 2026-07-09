import { PixelButton } from '@/modules/shared/components/pixel-button/PixelButton'
import { SegmentedControl } from '@/modules/shared/components/segmented-control'
import type { ThemeVariant } from '@/modules/shared/providers/theme-provider'
import type { TradingMode } from '@/modules/shared/providers/trading-mode-provider'
import { THEME_OPTIONS, TRADING_MODE_OPTIONS } from './onboarding-stepper.constants'
import styles from './onboarding-stepper.module.css'
import type { PersonalizeStepView } from './onboarding-stepper.types'

/**
 * Final new-account step: pick the app theme + the mobile trading layout. Both
 * apply live as the user toggles (the view's handlers write through the shared
 * providers); "Done" closes onboarding. Defaults are sensible, so this is a
 * one-tap-through step.
 */
export function PersonalizeStep({ view }: { view: PersonalizeStepView }) {
  return (
    <div className={styles.form}>
      <p className={styles.prose}>Make it yours. You can change these any time in Settings.</p>

      <div className={styles.label}>
        <span>Theme</span>
        <SegmentedControl<ThemeVariant>
          options={THEME_OPTIONS}
          value={view.theme}
          onChange={view.onSelectTheme}
          ariaLabel="Theme"
        />
      </div>

      <div className={styles.label}>
        <span>Mobile trading layout</span>
        <SegmentedControl<TradingMode>
          options={TRADING_MODE_OPTIONS}
          value={view.tradingMode}
          onChange={view.onSelectTradingMode}
          ariaLabel="Mobile trading layout"
        />
      </div>

      <div className={styles.actions}>
        <PixelButton type="button" variant="accentFilled" fullWidth onClick={view.onDone}>
          Done
        </PixelButton>
      </div>
    </div>
  )
}
