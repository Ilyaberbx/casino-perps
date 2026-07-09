import { createContext, useContext } from 'react'
import type { UseThemeProviderReturn } from './theme-provider.types'

export const ThemeContext = createContext<UseThemeProviderReturn | null>(null)

export function useThemeContext(): UseThemeProviderReturn {
  const context = useContext(ThemeContext)
  const isContextMissing = context === null
  if (isContextMissing) {
    throw new Error('useThemeContext must be used within ThemeProvider')
  }
  return context
}
