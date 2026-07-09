import { useCallback, useEffect, useMemo, useState } from 'react'
import { errAsync } from 'neverthrow'
import type { WalletClient } from 'viem'
import { useAuth, useRecipientSuggestions } from '@/modules/account'
import { parseWalletAddress, type WalletAddress } from '@/modules/shared/domain'
import { logger } from '@/app/logger'
import { getAgentWalletAddress } from '../../api/get-agent-wallet'
import { createDefaultBaseUsdcBalanceReader } from '../../services/base-public-client'
import { createDefaultAgentWithdrawAuthorizer } from '../../services/base-transfer-clients'
import {
  createDelegationGrant,
  resolveDefaultGetDelegationStatus,
} from '../../services/delegation-grant'
import { resolveMinaraRecipient } from '../../agent-balance.config'
import { BASE_CHAIN_ID, MINARA_AGENT_ID } from '../../agent-balance.constants'
import { useAgentBalanceSheet } from '../../providers/agent-balance-sheet'
import {
  DelegationGrantError,
  type AgentWalletAddress,
  type AgentWithdrawAuthorizer,
  type DelegationGrantPort,
} from '../../agent-balance.types'
import type { DelegationConsentDeps } from '../delegation-consent'
import type {
  AgentBalanceSheetContent,
  AgentBalanceSheetContentDeps,
} from './agent-wallet-modal.types'

const log = logger.child({ module: 'agent-wallet-modal' })

/**
 * Stable default for the optional `deps`. A default-param `{}` literal allocates
 * a fresh object identity every render, which churns every `[deps]`-dependent
 * `useCallback` and re-fires the open-flow `useEffect` (re-fetching balances)
 * while the modal is open. Hoisting one frozen empty object keeps `deps`
 * identity-stable when the caller passes nothing (the production path).
 */
const EMPTY_DEPS: AgentBalanceSheetContentDeps = {}

/**
 * A typed placeholder grant port for the state where the delegation flow opens
 * before the Agent Wallet address has resolved. The consent surface only enables
 * grant/revoke once the address is read, so this never actually fires — it exists
 * so `getGrantPort()` is total without an unsafe cast.
 */
const UNAVAILABLE_GRANT_PORT: DelegationGrantPort = {
  grant: () =>
    errAsync(new DelegationGrantError('server', 'agent wallet not resolved')),
  revoke: () =>
    errAsync(new DelegationGrantError('server', 'agent wallet not resolved')),
}

/**
 * Smart hook behind the `<AgentWalletModal>` tab bodies. Owns the open flow
 * (`mode`) and the resolved deps for the three flows:
 *
 * - On open it reads the Agent Wallet address (server treasury), then reads the
 *   Agent Wallet's Base USDC (withdraw cap) via the env-backed reader — a failed
 *   read leaves the cap at `0` so a withdrawal never fires against a phantom
 *   balance.
 * - Deposit is receive-only (address + QR) — the body needs only the resolved
 *   Agent Wallet address, no broadcast wallet.
 * - The withdraw authorizer binds the EXPLICIT per-action prompt
 *   (`getAgentWalletBroadcastClient`, ADR-0082 — the Agent Wallet's OWN signer
 *   on Base, never the trading Selected Wallet), never the standing delegated
 *   signer (ADR-0046 D-7).
 *
 * Venue-independent — it never reads the active venue. Collaborators are
 * injectable so the hook is unit-testable without viem / Privy / HTTP.
 */
export function useAgentBalanceSheetContent(
  deps: AgentBalanceSheetContentDeps = EMPTY_DEPS,
): AgentBalanceSheetContent {
  const { mode, close } = useAgentBalanceSheet()
  const {
    apiClient,
    getAgentWalletBroadcastClient,
    switchMasterWalletChain,
    attachAgentSigner,
    removeAgentSigner,
  } = useAuth()
  // Destination suggestions for the withdraw form: the user's own wallets (self
  // kept — a withdrawal to your own wallet is a normal target) + recently-sent
  // addresses. Recorded on a successful withdrawal via `recordRecipient`.
  const { walletSuggestions, recentSuggestions, recordRecipient } = useRecipientSuggestions({
    selfAddress: null,
  })

  const [agentWalletAddress, setAgentWalletAddress] =
    useState<AgentWalletAddress | null>(null)
  const [agentUsdc, setAgentUsdc] = useState(0)

  // `account/`'s wallet-capability accessors take the branded `WalletAddress`
  // (shared/domain), while the Agent Wallet address here is the module-local
  // `AgentWalletAddress` (`0x${string}`, unbranded). Both represent the same
  // already-validated Base address (server treasury read / viem `isAddress`
  // upstream) — this just re-brands it at the boundary where the two types meet.
  const agentWalletMasterAddress = useMemo<WalletAddress | null>(() => {
    if (agentWalletAddress === null) return null
    return parseWalletAddress(agentWalletAddress).unwrapOr(null)
  }, [agentWalletAddress])

  const isOpen = mode !== null

  const resolveAgentWalletAddress = useCallback(
    (): Promise<AgentWalletAddress | null> =>
      deps.getAgentWalletAddress
        ? deps.getAgentWalletAddress()
        : getAgentWalletAddress(apiClient).unwrapOr(null),
    [deps, apiClient],
  )

  const readUsdcBalance = useCallback(
    (address: AgentWalletAddress): Promise<number> =>
      deps.readUsdcBalance
        ? deps.readUsdcBalance(address)
        : // The shared module-level singleton (memoized + in-flight de-dup), so
          // the modal's up-to-two reads per open coalesce with the tile's read
          // instead of constructing a fresh viem client each call (slice OPT-M1).
          createDefaultBaseUsdcBalanceReader().readUsdcBalance(address).unwrapOr(0),
    [deps],
  )

  const resolveBroadcastWalletClient = useCallback(
    (): Promise<WalletClient | null> => {
      if (deps.getBroadcastWalletClient) return deps.getBroadcastWalletClient()
      // ADR-0082: sign as the Agent Wallet's OWN signer — never the trading
      // Selected Wallet. A withdrawal moves the Agent Wallet's own USDC, so it
      // must never resolve to a different wallet's key.
      if (agentWalletMasterAddress === null) return Promise.resolve(null)
      return getAgentWalletBroadcastClient(agentWalletMasterAddress)
    },
    [deps, agentWalletMasterAddress, getAgentWalletBroadcastClient],
  )

  const switchToBase = useCallback(
    async (): Promise<'switched' | 'rejected' | 'failed'> => {
      if (deps.switchToBase) return deps.switchToBase()
      if (agentWalletMasterAddress === null) return 'failed'
      const outcome = await switchMasterWalletChain(agentWalletMasterAddress, BASE_CHAIN_ID)
      const didSwitch = outcome === 'switched'
      if (!didSwitch) return outcome
      // ADR-0080 D-3: Privy does not update already-built providers, so a
      // resolved switch is not proof the chain actually changed — re-verify via
      // a freshly built client before reporting success.
      const client = await getAgentWalletBroadcastClient(agentWalletMasterAddress)
      if (client === null) return 'failed'
      const chainId = await client.getChainId()
      return chainId === BASE_CHAIN_ID ? 'switched' : 'failed'
    },
    [deps, agentWalletMasterAddress, switchMasterWalletChain, getAgentWalletBroadcastClient],
  )

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    resolveAgentWalletAddress().then((address) => {
      if (cancelled || address === null) return
      setAgentWalletAddress(address)
      readUsdcBalance(address).then((usdc) => {
        if (!cancelled) setAgentUsdc(usdc)
      })
    })

    return () => {
      cancelled = true
    }
  }, [isOpen, resolveAgentWalletAddress, readUsdcBalance])

  const getWithdrawAuthorizer = useCallback(
    (): AgentWithdrawAuthorizer =>
      createDefaultAgentWithdrawAuthorizer(resolveBroadcastWalletClient),
    [resolveBroadcastWalletClient],
  )

  const depositDeps = useMemo(
    () => ({ agentWalletAddress }),
    [agentWalletAddress],
  )

  const withdrawDeps = useMemo(
    () => ({
      availableUsdc: agentUsdc,
      getWithdrawAuthorizer,
      walletSuggestions,
      recentSuggestions,
      onRecordRecipient: recordRecipient,
      switchToBase,
    }),
    [
      agentUsdc,
      getWithdrawAuthorizer,
      walletSuggestions,
      recentSuggestions,
      recordRecipient,
      switchToBase,
    ],
  )

  // `import.meta.env` is not typed with `VITE_MINARA_X402_RECIPIENT`; widen to
  // the indexable shape `resolveMinaraRecipient` validates (mirrors the Base RPC
  // resolution). `null` when no valid recipient is configured → no consent. The
  // cap + TTL are user-configured in the consent surface, not resolved here.
  const recipient =
    deps.delegationRecipient !== undefined
      ? deps.delegationRecipient
      : resolveMinaraRecipient(import.meta.env as Record<string, string | undefined>)

  const getDelegationStatus = deps.getDelegationStatus
  const depsAttachAgentSigner = deps.attachAgentSigner
  const depsRemoveAgentSigner = deps.removeAgentSigner

  // ADR-0078: the grant port runs the 3-step handshake against the resolved Agent
  // Wallet address via the injected Privy attach/remove seams (defaults from
  // `useAuth()`). Until the address resolves the port is the no-op placeholder —
  // the consent surface only enables grant/revoke once the address is read.
  const getGrantPort = useCallback(
    (): DelegationGrantPort => {
      if (agentWalletAddress === null) return UNAVAILABLE_GRANT_PORT
      return createDelegationGrant({
        client: apiClient,
        agentId: MINARA_AGENT_ID,
        address: agentWalletAddress,
        attachAgentSigner: depsAttachAgentSigner ?? attachAgentSigner,
        removeAgentSigner: depsRemoveAgentSigner ?? removeAgentSigner,
      })
    },
    [
      agentWalletAddress,
      apiClient,
      depsAttachAgentSigner,
      depsRemoveAgentSigner,
      attachAgentSigner,
      removeAgentSigner,
    ],
  )

  const delegationDeps = useMemo<DelegationConsentDeps | null>(() => {
    if (recipient === null) return null
    return {
      recipient,
      getStatus:
        getDelegationStatus ??
        resolveDefaultGetDelegationStatus(apiClient, MINARA_AGENT_ID),
      getGrantPort,
    }
  }, [recipient, getDelegationStatus, apiClient, getGrantPort])

  log.debug({ mode }, 'modal content')

  return {
    mode,
    depositDeps,
    withdrawDeps,
    delegationDeps,
    close,
  }
}
