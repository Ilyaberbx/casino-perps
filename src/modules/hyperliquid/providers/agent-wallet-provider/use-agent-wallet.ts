import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { okAsync, errAsync, ResultAsync } from 'neverthrow'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { logger as appLogger } from '@/app/logger'
import { useAuth, useIsWalletConnected, useOnboardingFlow, useSelectedWallet } from '@/modules/account'
import type { WalletAddress } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import { scrubAddresses } from '@/modules/shared/logger'
import type { HyperliquidAgentWallet } from '../../gateway'
import { createAgentKeyStore } from '../../services/agent-key-store'
import type { HyperliquidExchangeGateway } from '../../gateway/nktkas-hyperliquid-exchange-gateway'
import { AgentWalletContext } from './agent-wallet-provider.context'
import type { AgentWalletState } from './agent-wallet-provider.context'
import { AgentApprovalError } from './agent-wallet-provider.types'
import type { AgentWalletStatus, HyperliquidKnownAgent } from './agent-wallet-provider.types'
import { buildAgentSigningWallet, gatewayKindToAgentReason } from './agent-wallet.utils'
import { useAgentBootstrap } from './use-agent-bootstrap'

// D-04: agentName length constraint (T-02-04 threat model mitigation).
const AGENT_NAME_MIN = 1
const AGENT_NAME_MAX = 16

// ---------------------------------------------------------------------------
// Consumer hook — thin context read
// ---------------------------------------------------------------------------

export function useAgentWallet(): AgentWalletState {
  const ctx = useContext(AgentWalletContext)
  if (!ctx) throw new Error('useAgentWallet must be used inside <AgentWalletProvider>')
  return ctx
}

// ---------------------------------------------------------------------------
// Smart hook — drives the agent wallet state machine
// ---------------------------------------------------------------------------

/**
 * `useOwnAgentWallet` is the smart hook mounted by `AgentWalletProvider`.
 * It accepts the exchange gateway as a parameter so the provider can pass
 * its internally-constructed gateway while tests can inject a fake.
 *
 * `network` defaults to 'mainnet' but the provider passes `hyperliquidConfig.network`.
 *
 * `logger` defaults to the `@/app/logger` singleton; the provider passes its own
 * bound logger and tests inject a fake so the swallow-point record is assertable.
 */
export function useOwnAgentWallet(
  exchangeGateway: HyperliquidExchangeGateway,
  network: string,
  logger: Logger = appLogger,
): AgentWalletState {
  const log = useMemo(() => logger.child({ module: 'hyperliquid-agent-wallet' }), [logger])
  const { getMasterViemAccount } = useAuth()
  const isConnected = useIsWalletConnected()
  const onboarding = useOnboardingFlow()
  // ADR-0061: two addresses, cleanly split. The agent **key + name** are keyed on
  // the account's Native (embedded) wallet (`nativeAddress`) — ONE agent per
  // account, stable across selected-wallet switches. The on-chain `queryAgents`
  // and the `approveAgent` **grant** key on the connectable Selected-Wallet master
  // (`masterAddress`) — the selected wallet grants the account's agent access.
  // `masterAddress` is `null` when the selection is not connectable (Fix 3), which
  // collapses signing to `signing-unavailable` (connect-to-grant), never Native.
  const { masterAddress, nativeAddress } = useSelectedWallet()

  const [status, setStatus] = useState<AgentWalletStatus>('checking')
  // PITFALL 3: private key NEVER in state — only in a ref
  const agentPrivateKeyRef = useRef<`0x${string}` | null>(null)
  const [agentAddress, setAgentAddress] = useState<WalletAddress | null>(null)
  // Public on-chain extraAgents data (names/addresses/expiries — never keys).
  // Set by bootstrap; refreshed on a reactive cap rejection; feeds the
  // slots-full victim picker (ADR-0036 D-3).
  const [existingAgents, setExistingAgents] = useState<ReadonlyArray<HyperliquidKnownAgent> | null>(
    null,
  )

  // Mirror status into a ref so the stable `getSigningWallet` closure reads the
  // live value (a connected agent that was loaded after the closure was built)
  // without being recreated on every status change. The closure must be stable
  // because it is registered once into the app-scope signing-wallet holder.
  // Synced via an effect (not during render — refs must not be written there).
  const isApprovedRef = useRef(false)
  useEffect(() => {
    isApprovedRef.current = status === 'approved'
  }, [status])

  // Stable key store — never re-created per render
  const agentKeyStore = useMemo(() => createAgentKeyStore(), [])

  const isOnboardingComplete = onboarding.kind === 'ready'
  const hasMasterWallet = masterAddress !== null
  const hasNativeWallet = nativeAddress !== null
  const canLoad = isConnected && isOnboardingComplete && hasMasterWallet && hasNativeWallet

  useAgentBootstrap({
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
  })

  const approve = useCallback(
    (agentName: string) => {
      // T-02-04: validate agentName length before calling gateway (mitigate tampering threat).
      // After widening (#166) the `invalid-name` reason is removed from the union;
      // name length is treated as a `name-collision`-shaped UX (pick a different label)
      // since both surface through the same retry-with-new-name CTA.
      const isNameTooShort = agentName.length < AGENT_NAME_MIN
      const isNameTooLong = agentName.length > AGENT_NAME_MAX
      const isNameInvalid = isNameTooShort || isNameTooLong
      if (isNameInvalid) {
        return errAsync(
          new AgentApprovalError(
            'name-collision',
            `agentName must be ${AGENT_NAME_MIN}–${AGENT_NAME_MAX} chars`,
          ),
        )
      }

      // Guard: signing not available if no resolvable (connectable) master wallet.
      // After Fix 3 this is `null` for a picked-but-not-connected imported wallet,
      // so approve surfaces 'signing-unavailable' (connect-to-grant) — never a
      // silent Native-wallet signature.
      if (masterAddress === null) {
        return errAsync(
          new AgentApprovalError('signing-unavailable', 'No master wallet connected'),
        )
      }
      // Guard: the account identity (Native wallet) must be known to key the agent.
      if (nativeAddress === null) {
        return errAsync(
          new AgentApprovalError('signing-unavailable', 'No native wallet resolved'),
        )
      }

      // A corrupted stored key surfaces as 'corrupted-key' (the reset CTA clears it)
      // before we mint — so the user explicitly resets rather than silently overwrites.
      const loadResult = agentKeyStore.load(nativeAddress, network)
      if (loadResult.isErr()) {
        return errAsync(
          new AgentApprovalError('corrupted-key', 'stored agent key is unreadable'),
        )
      }
      // ADR-0077: Hyperliquid enforces anti-replay on agent addresses — an address
      // can be approved ONCE, ever. So `approve()` always mints a FRESH keypair;
      // reusing the stored key (the reverted ADR-0061 D-1) re-submits a used address
      // and HL rejects with "Extra agent already used". The stable native-keyed NAME
      // (ADR-0061 D-2) still collapses repeat approvals onto one HL slot, so
      // proliferation stays bounded (the ADR-0036 D-1 model).
      const newPrivateKey = generatePrivateKey()
      const agentAccount = privateKeyToAccount(newPrivateKey)

      setStatus('approving')

      // Resolve the master viem account then call approveAgent. ADR-0060/0061: the
      // GRANT is signed by the SELECTED WALLET — pass the resolved `masterAddress`
      // (embedded included), not the Privy-canonical primary wallet. Non-null above.
      const getMasterAccountAsync = ResultAsync.fromPromise(
        getMasterViemAccount(masterAddress),
        (cause) => new AgentApprovalError('signing-unavailable', 'getMasterViemAccount threw', cause),
      ).andThen((masterAccount) => {
        if (masterAccount === null) {
          return errAsync(
            new AgentApprovalError('signing-unavailable', 'Master wallet not available'),
          )
        }
        return okAsync(masterAccount)
      })

      return getMasterAccountAsync.andThen((masterAccount) =>
        exchangeGateway
          // masterAccount is a viem WalletClient returned by getMasterViemAccount (ADR-0012).
          // HyperliquidExchangeGateway.approveAgent now accepts WalletClient directly — no cast.
          .approveAgent(masterAccount, agentAccount.address, agentName)
          .mapErr(
            (cause) =>
              new AgentApprovalError(
                gatewayKindToAgentReason(cause.kind),
                `approveAgent failed: ${cause.kind}`,
                cause,
              ),
          ),
      ).andThen(() => {
        // Persist the key — save() returns a typed Result; a storage failure short-circuits here.
        // NEVER return the private key in state (PITFALL 3 stays intact).
        //
        // #167: on-chain approve already succeeded by the time we reach this branch,
        // so a storage failure here is structurally different from a generic 'unknown'
        // failure — clicking Approve again would burn a second agent slot. Map to the
        // dedicated `keystore-write-after-approval` reason whose CTA is 'reload-page'.
        const saveResult = agentKeyStore.save(nativeAddress, network, newPrivateKey)
        return saveResult.mapErr(
          (): AgentApprovalError =>
            new AgentApprovalError(
              'keystore-write-after-approval',
              'agent approved on-chain but local key persistence failed',
            ),
        )
      }).map(() => {
        // Only on save success: update ref and state — key never returned in state.
        // `agentAccount.address` is viem's checksummed `0x${string}` for this key;
        // the WalletAddress brand is a lowercased `0x${string}`, so lowercasing
        // satisfies the brand's invariant.
        agentPrivateKeyRef.current = newPrivateKey
        setAgentAddress(agentAccount.address.toLowerCase() as WalletAddress)
        setStatus('approved')
      }).mapErr((e) => {
        // Swallow point: the approve failure is being collapsed into error state
        // here, so this is where we own the one diagnosable log line (logging.md
        // rule 5 — the producer logs only because it swallows). `cause` carries the
        // real underlying reason behind an opaque `'unknown'` panel, address-scrubbed
        // at the boundary (the agent private key never enters any field — it lives
        // only in `agentPrivateKeyRef`, never in `e` or its cause).
        const scrubbedCause = scrubAddresses(e.cause instanceof Error ? e.cause.message : String(e.cause))
        const fields = { reason: e.kind, errorMessage: e.message, cause: scrubbedCause }
        // The unclassified bucket (`unknown` / its legacy `approval-failed` alias)
        // is the one that renders the unhelpful "UNKNOWN" panel — warn it. Every
        // other reason is self-describing (a benign user cancel, a name collision,
        // a known cap) → info, so a routine reject does not spam warn.
        const isUnclassifiedFailure = e.kind === 'unknown' || e.kind === 'approval-failed'
        if (isUnclassifiedFailure) log.warn(fields, 'agent approval failed')
        if (!isUnclassifiedFailure) log.info(fields, 'agent approval rejected')
        // Mirror the gateway/Approval error reason into the step status so the
        // CTA mapping can render the right copy. Every reason in the union is
        // a valid status (see `agent-wallet-provider.types.ts`).
        setStatus({ kind: 'error', reason: e.kind })
        // A reactive cap rejection means a slot filled since bootstrap —
        // refresh the on-chain agent list so the victim picker is current
        // (ADR-0036 D-2). Fire-and-forget: the picker renders from state when
        // the refresh lands; a refresh failure keeps the bootstrap-time list.
        if (e.kind === 'agent-slots-full') {
          void exchangeGateway.queryAgents(masterAddress).map(setExistingAgents)
        }
        return e
      })
    },
    [masterAddress, nativeAddress, getMasterViemAccount, exchangeGateway, agentKeyStore, network, log],
  )

  // Stable signing-wallet getter for the trader bridge. Reads the in-memory key
  // ref + live status ref and builds the viem `AbstractWallet` lazily, per call,
  // at signing time. The key never leaves the ref (no state, no logs, no
  // serialization). Returns `null` when no agent is approved/loaded — the trader
  // maps that to a typed `rejected` error rather than throwing.
  const getSigningWallet = useCallback((): HyperliquidAgentWallet | null => {
    if (!isApprovedRef.current) return null
    return buildAgentSigningWallet(agentPrivateKeyRef.current)
  }, [])

  return { status, agentAddress, existingAgents, approve, getSigningWallet }
}
