import { createContext } from 'react'
import type { AppConfigValue } from './app-config-provider.types'

export const AppConfigContext = createContext<AppConfigValue | null>(null)
