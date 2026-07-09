import { type RefObject } from 'react'
import type { WalletAddress } from '@/modules/shared/domain'
import { useSessionBootstrap } from '../../hooks/use-session-bootstrap'
import { HYPERLIQUID_MAX_NAMED_AGENTS } from '../../hyperliquid.constants'
import { deriveDefaultAgentName } from '../../hyperliquid.utils'
import type { AgentKeyStore } from '../../services/agent-key-store'
import type { HyperliquidExchangeGateway } from '../../gateway/nktkas-hyperliquid-exchange-gateway'
import type { AgentWalletStatus, HyperliquidKnownAgent } from './agent-wallet-provider.types'
import { resolveAgentDesync } from './agent-wallet.utils'

export interface AgentBootstrapOptions {
  readonly isConnected: boolean
  readonly canLoad: boolean
  /** The connectable Selected-Wallet master — keys `queryAgents` + the grant (ADR-0061). */
  readonly masterAddress: WalletAddress | null
  /** The account's Native (embedded) wallet — keys the agent key + name (ADR-0061). */
  readonly nativeAddress: WalletAddress | null
  readonly network: string
  readonly agentKeyStore: AgentKeyStore
  readonly exchangeGateway: HyperliquidExchangeGateway
  readonly agentPrivateKeyRef: RefObject<`0x${string}` | null>
  setStatus(status: AgentWalletStatus): void
  setAgentAddress(address: WalletAddress | null): void
  setExistingAgents(agents: ReadonlyArray<HyperliquidKnownAgent> | null): void
}

/**
 * Owns the agent-wallet bootstrap lifecycle (WR-AG-01) on top of the shared
 * `useSessionBootstrap` scaffolding (WR-GEN-01): on disconnect it clears
 * status/address/key/agents; once per connect session it reads the keystore,
 * queries the user's on-chain agents, then `switch`es on the pure desync
 * resolution (`resolveAgentDesync`, ADR-0036 D-2) — no nested conditionals,
 * no non-null assertions.
 */
export function useAgentBootstrap(options: AgentBootstrapOptions): void {
  const {
    isConnected,
    canLoad,
    masterAddress,
    nativeAddress,
    network,
    agentKeyStore,
    exchangeGateway,
    agentPrivateKeyRef,
    setStatus,
    setAgentAddress,
    setExistingAgents,
  } = options

  useSessionBootstrap({
    isConnected,
    canBootstrap: canLoad,
    // Slice 07: re-key on the Selected Wallet master so a mid-session selection
    // switch resets + re-bootstraps for the newly-selected account, without a
    // disconnect. The per-address keystore keys are untouched across the switch.
    bootstrapKey: masterAddress,
    onReset: () => {
      setStatus('checking')
      setAgentAddress(null)
      setExistingAgents(null)
      agentPrivateKeyRef.current = null
    },
    // SEC-M1: on a FULL disconnect (logout), wipe the plaintext agent private
    // key(s) from localStorage so they don't survive the session on a shared /
    // compromised browser. `clearAll()` (not the targeted `clear`) is deliberate
    // — it also purges stale keys left by a previous user/account. This fires
    // only on the `isConnected → false` cleanup, never on a mid-session
    // Selected-Wallet switch (the account-stable native-keyed agent must survive
    // a master switch). A storage failure degrades to a no-op (typed Result, not
    // a throw); the key is never logged.
    onDisconnect: () => {
      agentKeyStore.clearAll()
    },
    // Bootstrap order (#167): keystore read → queryAgents → pure desync resolution.
    // ADR-0061: the agent key + name are keyed on the account's Native wallet
    // (`nativeAddress`, one agent per account); `queryAgents` + the grant key on
    // the connectable Selected-Wallet master (`masterAddress`).
    run: async (isCancelled) => {
      if (masterAddress === null || nativeAddress === null) return
      const loadResult = agentKeyStore.load(nativeAddress, network)
      if (isCancelled()) return
      if (loadResult.isErr()) {
        setStatus({ kind: 'error', reason: 'corrupted-key' })
        return
      }

      const agentsResult = await exchangeGateway.queryAgents(masterAddress)
      if (isCancelled()) return
      // Network/transport error on the pre-flight query: collapse to 'unknown'
      // (the user can retry via the existing CTA path; we don't lock them out of
      // approve() — but we also don't blindly trust the local key, since doing so
      // would re-introduce the desync the query is designed to detect).
      if (agentsResult.isErr()) {
        setStatus({ kind: 'error', reason: 'unknown' })
        return
      }
      setExistingAgents(agentsResult.value)

      const expectedAgentName = deriveDefaultAgentName(nativeAddress)
      const resolution = resolveAgentDesync(
        loadResult.value,
        agentsResult.value,
        expectedAgentName,
        HYPERLIQUID_MAX_NAMED_AGENTS,
      )
      if (resolution.kind === 'missing') {
        setStatus('missing')
        return
      }
      // An agent named OURS is stranded (key lost) — the one-click same-name
      // replace CTA recovers it with a single signature (ADR-0036 D-1/D-2).
      if (resolution.kind === 'stale-own-agent') {
        setStatus({ kind: 'error', reason: 'agent-exists-no-local-key' })
        return
      }
      // Every named slot is foreign-owned — approving any new name would be
      // rejected on the cap; the victim picker is the only path (ADR-0036 D-3).
      if (resolution.kind === 'slots-full') {
        setStatus({ kind: 'error', reason: 'agent-slots-full' })
        return
      }
      agentPrivateKeyRef.current = resolution.privateKey
      setAgentAddress(resolution.address)
      setStatus('approved')
    },
  })
}
