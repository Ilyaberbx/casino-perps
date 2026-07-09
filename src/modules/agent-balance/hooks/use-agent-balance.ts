import { useEffect, useState } from 'react'
import { okAsync, ResultAsync } from 'neverthrow'
import { useAuth, useIsWalletConnected } from '@/modules/account'
import { formatUsd } from '@/modules/shared/utils/format-number'
import { NetworkError, requestIdFrom, type HttpError } from '@/modules/shared/http'
import { logger } from '@/app/logger'
import { EMPTY_BALANCE_DISPLAY } from '../agent-balance.constants'
import {
  resolveDefaultGetAgentWallet,
  type AgentWalletInfo,
} from '../api/get-agent-wallet'
import {
  registerAgentWallet,
  type RegisterAgentWalletInput,
} from '../api/register-agent-wallet'
import { createDefaultBaseUsdcBalanceReader } from '../services/base-public-client'
import type {
  AgentBalanceStatus,
  AgentBalanceViewModel,
  AgentWalletAddress,
  BaseUsdcBalanceReader,
} from '../agent-balance.types'
import type { GetAgentWallet } from '../api/get-agent-wallet'

const log = logger.child({ module: 'agent-balance' })

/**
 * Collaborators for the Agent Balance hook. Injected so the hook is
 * unit-testable without viem / Privy / HTTP: tests supply a fake reader, a fake
 * agent-wallet fetcher (returning `okAsync(info)` / `okAsync(null)` /
 * `errAsync`), and fake create/register seams. Production fills them from the
 * env-backed defaults + `useAuth().createAgentWallet`.
 */
export interface UseAgentBalanceDeps {
  readonly reader?: BaseUsdcBalanceReader
  readonly getAgentWallet?: GetAgentWallet
  /** Creates the user-owned Agent Wallet on a 404 (default `useAuth().createAgentWallet`). */
  readonly createAgentWallet?: () => Promise<{ address: string; walletId: string }>
  /** Registers a freshly created Agent Wallet (default binds the shared `apiClient`). */
  readonly registerAgentWallet?: (
    input: RegisterAgentWalletInput,
  ) => ResultAsync<AgentWalletInfo, HttpError>
}

/**
 * The module's public Agent Balance reading hook. Owns the disconnected gate,
 * the agent-wallet ENSURE flow, and the Base `USDC.balanceOf` read. The ensure
 * flow (ADR-0078): GET `/wallet`; on **404 not-registered** (the fetcher resolves
 * `null`) it creates a user-owned embedded Agent Wallet on the client
 * (`createAgentWallet`) and registers it (`registerAgentWallet`), then reads the
 * balance off the resulting address. Deliberately venue-independent — it never
 * reads the active venue nor any venue capability. Every collaborator returns a
 * neverthrow `Result` (the create seam's throw is coerced to a `NetworkError`),
 * so there is no `try/catch`; a failed step leaves the figure at the empty
 * placeholder and `status: 'error'`.
 */
export function useAgentBalance(
  deps: UseAgentBalanceDeps = {},
): AgentBalanceViewModel {
  const isConnected = useIsWalletConnected()
  const { apiClient, createAgentWallet: authCreateAgentWallet } = useAuth()

  const [balance, setBalance] = useState<number | null>(null)
  const [agentWalletAddress, setAgentWalletAddress] = useState<AgentWalletAddress | null>(null)
  // The read lifecycle (slice 12). Seeded 'loading' on the initial connection,
  // then re-armed to 'loading' during render whenever the connection flips back
  // on (the same converger idiom used across the app) — so the effect only
  // setStates in its async resolution, never synchronously (React 19 / React
  // Compiler). The effect drives it to 'ready'/'error'.
  const [phase, setPhase] = useState<AgentBalanceStatus>(() =>
    isConnected ? 'loading' : 'idle',
  )
  const [connectedSeen, setConnectedSeen] = useState(isConnected)
  if (isConnected !== connectedSeen) {
    setConnectedSeen(isConnected)
    if (isConnected) setPhase('loading')
  }

  useEffect(() => {
    if (!isConnected) return

    const reader = deps.reader ?? createDefaultBaseUsdcBalanceReader()
    const getAgentWallet =
      deps.getAgentWallet ?? resolveDefaultGetAgentWallet(apiClient)
    const createAgentWallet = deps.createAgentWallet ?? authCreateAgentWallet
    const register =
      deps.registerAgentWallet ??
      ((input: RegisterAgentWalletInput) => registerAgentWallet(apiClient, input))

    let cancelled = false

    // Ensure a registered Agent Wallet: use the server read, or on 404 create a
    // user-owned embedded wallet on the client and register it (ADR-0078).
    const ensureWallet = (): ResultAsync<AgentWalletInfo, HttpError> =>
      getAgentWallet().andThen((wallet) => {
        if (wallet !== null) return okAsync(wallet)
        return ResultAsync.fromPromise(
          createAgentWallet(),
          (cause) => new NetworkError('agent wallet create failed', cause),
        ).andThen((created) =>
          register({ address: created.address, walletId: created.walletId }),
        )
      })

    ensureWallet()
      .andThen((wallet) => {
        if (!cancelled) setAgentWalletAddress(wallet.address)
        return reader.readUsdcBalance(wallet.address)
      })
      .match(
        (next) => {
          if (cancelled) return
          setBalance(next)
          setPhase('ready')
        },
        (error) => {
          if (cancelled) return
          const requestId = requestIdFrom(error)
          log.warn(
            { kind: error.kind, ...(requestId ? { requestId } : {}) },
            'agent balance read failed',
          )
          setBalance(null)
          setPhase('error')
        },
      )

    return () => {
      cancelled = true
    }
  }, [
    isConnected,
    apiClient,
    authCreateAgentWallet,
    deps.reader,
    deps.getAgentWallet,
    deps.createAgentWallet,
    deps.registerAgentWallet,
  ])

  // Gate the figure on the live connection so a stale balance never lingers
  // after disconnect (the effect intentionally does not reset state — resetting
  // synchronously in an effect triggers cascading renders).
  const hasLiveBalance = isConnected && balance !== null
  const balanceUsd = hasLiveBalance ? balance : null
  const display = hasLiveBalance ? formatUsd(balance) : EMPTY_BALANCE_DISPLAY
  // Disconnected always reads `idle`, regardless of a stale `phase` left over
  // from a previous connection (the effect does not reset state on disconnect).
  const status: AgentBalanceStatus = isConnected ? phase : 'idle'
  // Gate the address on the live connection too, so a stale address never
  // lingers after disconnect (the effect does not reset state on disconnect).
  const liveAgentWalletAddress = isConnected ? agentWalletAddress : null

  return {
    balanceUsd,
    display,
    status,
    agentWalletAddress: liveAgentWalletAddress,
  }
}
