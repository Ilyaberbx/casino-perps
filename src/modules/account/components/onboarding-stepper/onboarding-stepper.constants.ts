import type { ThemeVariant } from '@/modules/shared/providers/theme-provider'

export const RESEND_LOCKOUT_SECONDS = 60
export const HANDLE_DEBOUNCE_MS = 300
export const TOTAL_STEPS = 5

/** Theme segments for the Personalize step (the app theme is dark / white). */
export const THEME_OPTIONS: ReadonlyArray<{ readonly value: ThemeVariant; readonly label: string }> = [
  { value: 'dark', label: 'Dark' },
  { value: 'white', label: 'Light' },
] as const
