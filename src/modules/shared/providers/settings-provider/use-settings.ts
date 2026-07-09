import { useContext } from 'react'
import { SettingsContext } from './settings-provider.context'
import type { SettingsContextValue } from './settings-provider.types'

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) {
    throw new Error('useSettings must be used inside <SettingsProvider>')
  }
  return ctx
}
