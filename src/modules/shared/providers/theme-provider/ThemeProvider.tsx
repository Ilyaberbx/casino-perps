import { useThemeProvider } from './use-theme-provider'
import { ThemeContext } from './theme-provider.context'
import type { ThemeProviderProps } from './theme-provider.types'

export function ThemeProvider({ children }: ThemeProviderProps) {
  const themeState = useThemeProvider()

  return <ThemeContext value={themeState}>{children}</ThemeContext>
}
