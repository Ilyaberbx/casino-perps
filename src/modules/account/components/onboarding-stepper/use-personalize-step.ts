import { useCallback } from 'react'
import { useThemeContext } from '@/modules/shared/providers/theme-provider'
import type { ThemeVariant } from '@/modules/shared/providers/theme-provider'
import type { PersonalizeStepView } from './onboarding-stepper.types'

/**
 * Builds the Personalize step view from the shared appearance provider. The theme
 * choice applies (and persists) live as the user picks it — via the provider's
 * `toggleTheme` (two variants, so selecting the other = toggle). `onDone` is the
 * FSM's `finishPersonalize`, threaded in by the stepper hook.
 */
export function usePersonalizeStep(onDone: () => void): PersonalizeStepView {
  const { theme, toggleTheme } = useThemeContext()

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
    onDone,
  }
}
