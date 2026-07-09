import { useEffect, useState } from 'react'
import { getAppConfig } from '@/modules/shared/api/get-app-config'
import { AppConfigContext } from './app-config-provider.context'
import type { AppConfigValue, AppConfigProviderProps } from './app-config-provider.types'

/**
 * Fetches client-facing feature flags from `GET /api/config` once the user is
 * authenticated, and exposes them via `useAppConfig()`. **Fail-safe default:**
 * `inviteGateEnabled` starts `true` and stays `true` if the fetch errors — a
 * gated app must not silently drop its gate because a config read failed.
 */
export function AppConfigProvider({ apiClient, enabled, children }: AppConfigProviderProps) {
  const [value, setValue] = useState<AppConfigValue>({ inviteGateEnabled: true })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void getAppConfig(apiClient).match(
      (config) => {
        if (!cancelled) setValue(config)
      },
      // Fail-safe: keep the gate enabled when the flag can't be read.
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [apiClient, enabled])

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>
}
