import type { ReactNode } from 'react'
import type { ApiClient } from '@/modules/shared/http'

/** The resolved client-facing feature flags. */
export type AppConfigValue = {
  inviteGateEnabled: boolean
}

export type AppConfigProviderProps = {
  apiClient: ApiClient
  /**
   * Whether the fetch should run. The transport needs a Privy JWT, so the
   * composition root passes `authenticated` here — the flag is only read on the
   * post-auth Handle step anyway.
   */
  enabled: boolean
  children: ReactNode
}
