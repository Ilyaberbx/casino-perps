import { useMemo } from 'react'
import { PrivyProvider } from '@privy-io/react-auth'
import { arbitrum, base } from 'viem/chains'
import { resolveHyperEvmChain } from '@/modules/hyperliquid'
import type { AuthProviderProps } from './auth-provider.types'
import { AuthBridge } from './AuthBridge'
import { resolveMockAuthConfig } from '../../account.config'
import { MockAuthBridge } from './MockAuthBridge'

// Privy dashboard configuration: email-OTP is the sole onboarding path
// (PRD-0006 Slice 03 / ADR-0058). `loginMethods: ['email']` removes external
// wallets as a *login entry point* (they return as imports in Slice 06).
// Two-factor auth (Privy-native TOTP MFA) is an optional, skippable enrollment
// step — not a login method. `createOnLogin: 'users-without-wallets'` keeps the
// Native (embedded) wallet auto-provisioned at email login. The MFA-enroll and
// wallet handlers stay on `AuthState`; they are just not login entry points.
//
// `defaultChain` pins the app to Arbitrum One — the deposit/broadcast path is
// Arbitrum-only (ARBITRUM_CHAIN_ID), so embedded wallets default there. Without
// it Privy defaults embedded wallets to Ethereum mainnet and the deposit flow's
// "Switch to Arbitrum" branch could never clear (ADR-0060 open risk).
//
// `supportedChains` is the **allow-list** Privy validates `switchChain` /
// `addChain` against. Arbitrum (deposit), HyperEVM (the EVM⇄Core flow's
// Core-side chain, 999/998, ADR-0069), AND Base (the Agent Wallet withdraw's
// chain-switch preflight, ADR-0082) must all be listed: a chain that is not
// here is rejected, which is exactly why the EVM⇄Core "Switch to HyperEVM"
// button silently no-op'd before ADR-0080, and why the Agent Wallet withdraw's
// `switchMasterWalletChain(agentWallet, base.id)` would be rejected without this
// (ADR-0082). The HyperEVM chain is resolved from the build env so testnet (998)
// vs mainnet (999) matches the rest of the app. Resolved in the component (not
// at module scope) so the cross-module barrel import from `@/modules/hyperliquid`
// can't be read before it has initialised (circular-init `resolveHyperEvmChain is
// not a function`); `useMemo` keeps the chain stable and it is passed straight
// through to the Privy config below.
export function AuthProvider({ appId, apiBaseUrl, children }: AuthProviderProps) {
  const hyperEvmChain = useMemo(
    () => resolveHyperEvmChain(import.meta.env as Record<string, string | undefined>),
    [],
  )
  // DEV-ONLY mock-auth seam (ADR-0055): when `VITE_MOCK_AUTH === 'true'` in a
  // dev build, short-circuit Privy entirely and report a connected mock wallet
  // so headless verification (Playwright / Spectate Mode) can render the dock.
  // `resolveMockAuthConfig` returns null in any production build, so Vite
  // dead-code-eliminates this branch and `MockAuthBridge` from the bundle.
  const mockAuthConfig = resolveMockAuthConfig(import.meta.env)
  if (mockAuthConfig) {
    return (
      <MockAuthBridge apiBaseUrl={apiBaseUrl} config={mockAuthConfig}>
        {children}
      </MockAuthBridge>
    )
  }
  return (
    <PrivyProvider
      appId={appId}
      config={{
        defaultChain: arbitrum,
        supportedChains: [arbitrum, hyperEvmChain, base],
        embeddedWallets: {
          ethereum: { createOnLogin: 'users-without-wallets' },
        },
        loginMethods: ['email'],
        // Private-key EXPORT is owner-only and MFA-gated (ADR-0076 D-5): Privy
        // forces MFA enrollment, then shows its own MFA *verification* modal
        // before releasing the key. `noPromptOnMfaRequired: false` keeps that
        // verification UI ON — this `@privy-io/react-auth` v3 config is the
        // equivalent of the older `enableMfaVerificationUIs: true` flag (which
        // does not exist in this SDK version): if it were `true`, the app would
        // have to render its own MFA-verification UI, which we do not.
        mfa: { noPromptOnMfaRequired: false },
      }}
    >
      <AuthBridge apiBaseUrl={apiBaseUrl}>{children}</AuthBridge>
    </PrivyProvider>
  )
}
