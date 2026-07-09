import type { ReactNode } from 'react'
import { AppConfigContext } from '../app-config-provider.context'

/**
 * Test-only provider that injects an `AppConfigValue` directly (no fetch). The
 * invite gate defaults to **off** so existing onboarding tests — which send no
 * invite code — keep passing; pass `inviteGateEnabled` to exercise the gate-on
 * path.
 */
export function FakeAppConfigProvider({
  inviteGateEnabled = false,
  children,
}: {
  inviteGateEnabled?: boolean
  children: ReactNode
}) {
  return (
    <AppConfigContext.Provider value={{ inviteGateEnabled }}>
      {children}
    </AppConfigContext.Provider>
  )
}
