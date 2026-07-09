import { createContext } from 'react'
import type { SettingsContextValue } from './settings-provider.types'

export const SettingsContext = createContext<SettingsContextValue | null>(null)
