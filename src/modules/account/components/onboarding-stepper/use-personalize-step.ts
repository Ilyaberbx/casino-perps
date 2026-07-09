import { useCallback } from 'react'
import { useThemeContext } from '@/modules/shared/providers/theme-provider'
import { useTradingMode } from '@/modules/shared/providers/trading-mode-provider'
import type { ThemeVariant } from '@/modules/shared/providers/theme-provider'
import type { PersonalizeStepView } from './onboarding-stepper.types'

/**
 * Builds the Personalize step view from the shared appearance providers. Both
 * choices apply (and persist) live as the user picks them — theme via the
 * provider's `toggleTheme` (two variants, so selecting the other = toggle), mode
 * via `setMode`. `onDone` is the FSM's `finishPersonalize`, threaded in by the
 * stepper hook.
 */
export function usePersonalizeStep(onDone: () => void): PersonalizeStepView {
  const { theme, toggleTheme } = useThemeContext()
  const { mode, setMode } = useTradingMode()

  const onSelectTheme = useCallback(
    (next: ThemeVariant) => {
      if (next !== theme) toggleTheme()
    },
    [theme, toggleTheme],
  )

  return {
    kind: 'personalize',
    theme,
    onSelectTheme,
    tradingMode: mode,
    onSelectTradingMode: setMode,
    onDone,
  }
}
