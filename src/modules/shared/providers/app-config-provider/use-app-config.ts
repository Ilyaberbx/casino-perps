import { useContext } from 'react'
import { AppConfigContext } from './app-config-provider.context'
import type { AppConfigValue } from './app-config-provider.types'

export function useAppConfig(): AppConfigValue {
  const ctx = useContext(AppConfigContext)
  if (!ctx) {
    throw new Error('useAppConfig must be used inside <AppConfigProvider>')
  }
  return ctx
}
