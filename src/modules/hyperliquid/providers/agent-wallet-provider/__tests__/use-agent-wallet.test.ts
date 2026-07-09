import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { okAsync, errAsync, ResultAsync } from 'neverthrow'
import type { WalletClient } from 'viem'
import { AgentWalletContext, type AgentWalletState } from '../agent-wallet-provider.context'
import { useAgentWallet, useOwnAgentWallet } from '../use-agent-wallet'
import { buildFakeExchangeGateway } from '../../../gateway/__fixtures__/fake-exchange-gateway'
import { buildFakeLogger } from '../../../services/__fixtures__/web-data2'
import { HyperliquidGatewayError } from '../../../gateway/hyperliquid-gateway.types'
import type { WalletAddress } from '@/modules/shared/domain'

// ADR-0060: the accessors take the resolved Selected-Wallet master address. Type
// the default-state stubs so `Partial<typeof defaultAuthState>` overrides may
// either ignore the param (`async () => …`) or read it (`async (master) => …`).
type MasterAccountAccessor = (master: WalletAddress) => Promise<WalletClient | null>

// ---------------------------------------------------------------------------
// Mocks — both useAuth and useOnboardingFlow live in @/modules/account
// ---------------------------------------------------------------------------

const mockPrimaryWalletAddress: WalletAddress = '0xdeadbeef00000000000000000000000000000001' as WalletAddress

const defaultAuthState = {
  ready: true,
  authenticated: true,
  walletReady: true,
  primaryWalletAddress: mockPrimaryWalletAddress,
  getMasterViemAccount: (async () => null) as MasterAccountAccessor,
  getBroadcastWalletClient: (async () => null) as MasterAccountAccessor,
  privyId: null,
  walletAddress: null,
  walletSource: null,
  getAccessToken: async () => null,
  logout: async () => undefined,
  hasMfa: false,
  enrollMfa: () => okAsync(undefined),
  loginWithWallet: () => errAsync(new Error('stub') as never),
  openConnectModal: () => undefined,
  closeConnectModal: () => undefined,
  isConnectModalOpen: false,
  exportableAddresses: [],
  exportWallet: async () => {},
  importPrivateKey: async () => ({ address: '0x0000000000000000000000000000000000000000' }),
  apiClient: {} as never,
}

const defaultOnboardingState = { kind: 'ready' as const, me: {} as never }

// The Selected Wallet seam (ADR-0061). The agent-wallet hook splits two
// addresses: `nativeAddress` keys the agent KEY + NAME (one agent per account);
// `masterAddress` keys the on-chain `queryAgents` + the grant. Both default to
// the primary so single-wallet scenarios are unchanged; switch-wallet tests
// override `masterAddress` while `nativeAddress` (the account identity) stays put.
const defaultSelectedWallet = {
  selectedAddress: null as string | null,
  masterAddress: mockPrimaryWalletAddress as WalletAddress | null,
  nativeAddress: mockPrimaryWalletAddress as WalletAddress | null,
  isSelectionConnectable: true,
}

const { useAuthMock, useSelectedWalletMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useSelectedWalletMock: vi.fn(),
}))
vi.mock('@/modules/account', () => ({
  useAuth: useAuthMock,
  useOnboardingFlow: vi.fn(() => defaultOnboardingState),
  useSelectedWallet: useSelectedWalletMock,
  useIsWalletConnected: () => {
    const a = useAuthMock()
    return a.ready && a.authenticated && a.walletReady
  },
}))
useAuthMock.mockReturnValue(defaultAuthState)
useSelectedWalletMock.mockReturnValue(defaultSelectedWallet)

// Make viem generatePrivateKey deterministic for testing
vi.mock('viem/accounts', async () => {
  const actual = await vi.importActual<typeof import('viem/accounts')>('viem/accounts')
  return {
    ...actual,
    generatePrivateKey: vi.fn(() => ('0x' + 'a'.repeat(64)) as `0x${string}`),
  }
})

import { useAuth, useOnboardingFlow, useSelectedWallet } from '@/modules/account'
import { generatePrivateKey } from 'viem/accounts'

function setAuthState(overrides: Partial<typeof defaultAuthState>) {
  vi.mocked(useAuth).mockReturnValue({ ...defaultAuthState, ...overrides } as never)
}

function setSelectedWallet(overrides: Partial<typeof defaultSelectedWallet>) {
  vi.mocked(useSelectedWallet).mockReturnValue({
    ...defaultSelectedWallet,
    ...overrides,
  } as never)
}

function setOnboardingState(state: { kind: string } & Record<string, unknown>) {
  vi.mocked(useOnboardingFlow).mockReturnValue(state as never)
}

// ---------------------------------------------------------------------------
// Tests for useAgentWallet() consumer hook
// ---------------------------------------------------------------------------

describe('useAgentWallet() consumer hook', () => {
  it('throws when used outside AgentWalletProvider', () => {
    expect(() => renderHook(() => useAgentWallet())).toThrow(
      'useAgentWallet must be used inside <AgentWalletProvider>',
    )
  })

  it('returns context value when inside provider', () => {
    const contextValue: AgentWalletState = {
      status: 'approved',
      agentAddress: '0xabc' as WalletAddress,
      existingAgents: null,
      approve: () => okAsync(undefined),
      getSigningWallet: () => null,
    }
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(AgentWalletContext.Provider, { value: contextValue }, children)
    const { result } = renderHook(() => useAgentWallet(), { wrapper })
    expect(result.current.status).toBe('approved')
    expect(result.current.agentAddress).toBe('0xabc')
  })
})

// ---------------------------------------------------------------------------
// Tests for useOwnAgentWallet() smart hook
// ---------------------------------------------------------------------------

function makeStorageKey(address: string, network: string) {
  return `hl-agent-key:${address.toLowerCase()}:${network}`
}

const VALID_KEY = ('0x' + 'a'.repeat(64)) as `0x${string}`
const NETWORK = 'testnet'

// Pre-computed agent address that corresponds to VALID_KEY = 0x + 64*'a' under
// viem's privateKeyToAccount. Captured here as a constant so tests don't need
// to import viem just to derive it.
const VALID_KEY_AGENT_ADDRESS =
  '0x8fd379246834eac74b8419ffda202cf8051f7a03' as WalletAddress

// The hook derives the expected own-agent name from the NATIVE wallet
// (deriveDefaultAgentName(nativeAddress), ADR-0061) — the default native address
// is mockPrimaryWalletAddress, which ends in '0001'.
const OWN_AGENT_NAME = 'agent-0001'
const FOREIGN_AGENT_ADDRESS = '0xdeadbeefcafebabe0000000000000000deadbeef' as WalletAddress
const FAR_FUTURE_VALID_UNTIL = 4102444800000 // 2100-01-01

type HlAgentRow = { address: WalletAddress; name: string; validUntil: number }

function agentRow(name: string, address: WalletAddress = FOREIGN_AGENT_ADDRESS): HlAgentRow {
  return { address, name, validUntil: FAR_FUTURE_VALID_UNTIL }
}

// Default queryAgents stub for bootstrap calls — tests override per-scenario.
function emptyAgents() {
  return okAsync<ReadonlyArray<HlAgentRow>, HyperliquidGatewayError>([])
}
function agentsWithLocalKey() {
  return okAsync<ReadonlyArray<HlAgentRow>, HyperliquidGatewayError>([
    agentRow('local', VALID_KEY_AGENT_ADDRESS),
  ])
}

describe('useOwnAgentWallet() smart hook', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ ...defaultAuthState } as never)
    vi.mocked(useOnboardingFlow).mockReturnValue(defaultOnboardingState as never)
    vi.mocked(useSelectedWallet).mockReturnValue({ ...defaultSelectedWallet } as never)
    localStorage.clear()
  })

  it('returns status "approved" when localStorage has a valid key and HL agents match', async () => {
    localStorage.setItem(
      makeStorageKey(mockPrimaryWalletAddress, NETWORK),
      VALID_KEY,
    )
    const fakeGateway = buildFakeExchangeGateway({ queryAgents: agentsWithLocalKey })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toBe('approved')
  })

  it('returns status "missing" when HL returns no agents (new user)', async () => {
    const fakeGateway = buildFakeExchangeGateway({ queryAgents: emptyAgents })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toBe('missing')
  })

  it('returns { kind: "error", reason: "corrupted-key" } when store returns err (short-circuits before queryAgents)', async () => {
    localStorage.setItem(
      makeStorageKey(mockPrimaryWalletAddress, NETWORK),
      'not-a-valid-key',
    )
    const queryAgentsSpy = vi.fn(emptyAgents)
    const fakeGateway = buildFakeExchangeGateway({ queryAgents: queryAgentsSpy })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toEqual({ kind: 'error', reason: 'corrupted-key' })
    expect(queryAgentsSpy).not.toHaveBeenCalled()
  })

  it('getSigningWallet returns a signer once approved; null while missing', async () => {
    localStorage.setItem(makeStorageKey(mockPrimaryWalletAddress, NETWORK), VALID_KEY)
    const fakeGateway = buildFakeExchangeGateway({ queryAgents: agentsWithLocalKey })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toBe('approved')
    const signer = result.current.getSigningWallet()
    expect(signer).not.toBeNull()
    // The signer is the viem account derived from the in-memory key — its
    // address matches the approved agent, confirming the key was used.
    expect((signer as { address: string }).address.toLowerCase()).toBe(VALID_KEY_AGENT_ADDRESS)
  })

  it('getSigningWallet returns null when no agent is approved (status missing)', async () => {
    const fakeGateway = buildFakeExchangeGateway({ queryAgents: emptyAgents })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toBe('missing')
    expect(result.current.getSigningWallet()).toBeNull()
  })

  it('sets agentAddress on approved', async () => {
    localStorage.setItem(
      makeStorageKey(mockPrimaryWalletAddress, NETWORK),
      VALID_KEY,
    )
    const fakeGateway = buildFakeExchangeGateway({ queryAgents: agentsWithLocalKey })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.agentAddress).not.toBeNull()
    expect(typeof result.current.agentAddress).toBe('string')
  })

  it('returns { kind: "error", reason: "agent-exists-no-local-key" } when OUR named agent exists but no local key (stale-own-agent)', async () => {
    // No localStorage key; HL has an agent carrying our default name — the
    // one-click same-name replace flow (ADR-0036 D-2).
    const fakeGateway = buildFakeExchangeGateway({
      queryAgents: () =>
        okAsync<ReadonlyArray<HlAgentRow>, HyperliquidGatewayError>([agentRow(OWN_AGENT_NAME)]),
    })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toEqual({ kind: 'error', reason: 'agent-exists-no-local-key' })
  })

  it('returns { kind: "error", reason: "agent-exists-no-local-key" } when local key does not match OUR named agent', async () => {
    // Local key present but our on-chain agent was approved with a different key.
    localStorage.setItem(
      makeStorageKey(mockPrimaryWalletAddress, NETWORK),
      VALID_KEY,
    )
    const fakeGateway = buildFakeExchangeGateway({
      queryAgents: () =>
        okAsync<ReadonlyArray<HlAgentRow>, HyperliquidGatewayError>([agentRow(OWN_AGENT_NAME)]),
    })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toEqual({ kind: 'error', reason: 'agent-exists-no-local-key' })
  })

  it('returns "missing" when only a FOREIGN agent exists and a named slot is free (ADR-0036: not a desync)', async () => {
    const fakeGateway = buildFakeExchangeGateway({
      queryAgents: () =>
        okAsync<ReadonlyArray<HlAgentRow>, HyperliquidGatewayError>([agentRow('some-bot')]),
    })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toBe('missing')
  })

  it('returns { kind: "error", reason: "agent-slots-full" } and exposes existingAgents when 3 foreign agents fill the cap', async () => {
    const roster = [agentRow('bot-a'), agentRow('bot-b'), agentRow('bot-c')]
    const fakeGateway = buildFakeExchangeGateway({
      queryAgents: () => okAsync<ReadonlyArray<HlAgentRow>, HyperliquidGatewayError>(roster),
    })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toEqual({ kind: 'error', reason: 'agent-slots-full' })
    expect(result.current.existingAgents).toEqual(roster)
  })

  it('approve() cap rejection maps to agent-slots-full and refreshes existingAgents (ADR-0036)', async () => {
    setAuthState({
      getMasterViemAccount: async () => ({
        address: '0xmaster',
        signTypedData: async function fakeSign() { return '0x' },
      } as never),
    })
    const refreshedRoster = [agentRow('bot-a'), agentRow('bot-b'), agentRow('bot-c')]
    let queryCount = 0
    const fakeGateway = buildFakeExchangeGateway({
      approveAgent: () =>
        errAsync(new HyperliquidGatewayError('agent-cap-reached', 'too many agents')),
      queryAgents: () => {
        queryCount += 1
        // Bootstrap sees an empty roster; the post-rejection refresh sees the
        // full one (a slot filled mid-session).
        const roster = queryCount === 1 ? [] : refreshedRoster
        return okAsync<ReadonlyArray<HlAgentRow>, HyperliquidGatewayError>(roster)
      },
    })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    await act(async () => {
      await result.current.approve('test-agent')
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toEqual({ kind: 'error', reason: 'agent-slots-full' })
    expect(result.current.existingAgents).toEqual(refreshedRoster)
  })

  it('transitions to "approving" when approve() is called', async () => {
    // Set auth state BEFORE rendering the hook so closure captures correct getMasterViemAccount
    setAuthState({
      getMasterViemAccount: async () => ({
        address: '0xmaster',
        signTypedData: async function fakeSign() { return '0x' },
      } as never),
    })
    // Block approveAgent indefinitely via a ResultAsync wrapping a never-settling promise
    const neverSettle = ResultAsync.fromSafePromise(new Promise<void>(() => undefined))
    const fakeGateway = buildFakeExchangeGateway({
      approveAgent: () => neverSettle,
      queryAgents: emptyAgents,
    })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toBe('missing')
    act(() => {
      void result.current.approve('test-agent')
    })
    expect(result.current.status).toBe('approving')
  })

  it('transitions to "approved" after successful approveAgent', async () => {
    setAuthState({
      getMasterViemAccount: async () => ({
        address: '0xmaster',
        signTypedData: async function fakeSign() { return '0x' },
      } as never),
    })
    const fakeGateway = buildFakeExchangeGateway({
      approveAgent: () => okAsync(undefined),
      queryAgents: emptyAgents,
    })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    await act(async () => {
      await result.current.approve('test-agent')
    })
    expect(result.current.status).toBe('approved')
  })

  it('signs approveAgent as the embedded SELECTED master (ADR-0060 — no signing-unavailable abort)', async () => {
    // ADR-0060: an email-only user whose Selected Wallet is the embedded Native
    // wallet can approve an agent — the embedded master is passed to
    // getMasterViemAccount, which resolves a client, so approve reaches 'approved'
    // instead of bailing 'signing-unavailable'.
    const EMBEDDED_MASTER = '0xeeee000000000000000000000000000000000001' as WalletAddress
    setSelectedWallet({ masterAddress: EMBEDDED_MASTER })
    let receivedMaster: WalletAddress | null = null
    setAuthState({
      getMasterViemAccount: async (master: WalletAddress) => {
        receivedMaster = master
        return {
          address: EMBEDDED_MASTER,
          signTypedData: async function fakeSign() { return '0x' },
        } as never
      },
    })
    const fakeGateway = buildFakeExchangeGateway({
      approveAgent: () => okAsync(undefined),
      queryAgents: emptyAgents,
    })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    await act(async () => {
      await result.current.approve('test-agent')
    })
    expect(receivedMaster).toBe(EMBEDDED_MASTER)
    expect(result.current.status).toBe('approved')
  })

  it('transitions to { kind: "error", reason: "approval-failed" } after failed approveAgent', async () => {
    setAuthState({
      getMasterViemAccount: async () => ({
        address: '0xmaster',
        signTypedData: async function fakeSign() { return '0x' },
      } as never),
    })
    const fakeGateway = buildFakeExchangeGateway({
      approveAgent: () => errAsync(new HyperliquidGatewayError('network', 'failed')),
      queryAgents: emptyAgents,
    })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    await act(async () => {
      await result.current.approve('test-agent')
    })
    expect(result.current.status).toEqual({ kind: 'error', reason: 'unknown' })
  })

  it('logs warn "agent approval failed" with the scrubbed cause when the gateway error collapses to "unknown"', async () => {
    setAuthState({
      getMasterViemAccount: async () => ({
        address: '0xmaster',
        signTypedData: async function fakeSign() { return '0x' },
      } as never),
    })
    const { logger, records } = buildFakeLogger()
    const fakeGateway = buildFakeExchangeGateway({
      // `network` collapses to the unclassified `unknown` reason via
      // gatewayKindToAgentReason — the bucket that renders the unhelpful panel.
      approveAgent: () => errAsync(new HyperliquidGatewayError('network', 'rpc exploded')),
      queryAgents: emptyAgents,
    })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK, logger))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    await act(async () => {
      await result.current.approve('test-agent')
    })

    const failureRecord = records.find(
      (r) => r.level === 'warn' && r.message === 'agent approval failed',
    )
    expect(failureRecord).toBeDefined()
    expect(failureRecord?.fields.module).toBe('hyperliquid-agent-wallet')
    expect(failureRecord?.fields.reason).toBe('unknown')
    // The diagnosable detail: the real underlying gateway message survives into
    // the scrubbed `cause` field (this is what turns the opaque panel actionable).
    expect(String(failureRecord?.fields.cause)).toContain('rpc exploded')
  })

  it('approve() returns ResultAsync isOk() on success', async () => {
    setAuthState({
      getMasterViemAccount: async () => ({
        address: '0xmaster',
        signTypedData: async function fakeSign() { return '0x' },
      } as never),
    })
    const fakeGateway = buildFakeExchangeGateway({
      approveAgent: () => okAsync(undefined),
      queryAgents: emptyAgents,
    })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    let approveResult!: { isOk: () => boolean }
    await act(async () => {
      approveResult = await result.current.approve('test-agent')
    })
    expect(approveResult.isOk()).toBe(true)
  })

  it('approve() returns ResultAsync isErr() on failure', async () => {
    setAuthState({
      getMasterViemAccount: async () => ({
        address: '0xmaster',
        signTypedData: async function fakeSign() { return '0x' },
      } as never),
    })
    const fakeGateway = buildFakeExchangeGateway({
      approveAgent: () => errAsync(new HyperliquidGatewayError('network', 'failed')),
      queryAgents: emptyAgents,
    })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    let approveResult!: { isErr: () => boolean }
    await act(async () => {
      approveResult = await result.current.approve('test-agent')
    })
    expect(approveResult.isErr()).toBe(true)
  })

  it('does NOT fire auto-approve when onboarding is not "ready"', async () => {
    setOnboardingState({ kind: 'idle' })
    const approveAgentSpy = vi.fn(() => okAsync(undefined))
    const fakeGateway = buildFakeExchangeGateway({ approveAgent: approveAgentSpy, queryAgents: emptyAgents })
    renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    expect(approveAgentSpy).not.toHaveBeenCalled()
  })

  it('resets to "checking" and clears agentAddress when wallet disconnects', async () => {
    localStorage.setItem(
      makeStorageKey(mockPrimaryWalletAddress, NETWORK),
      VALID_KEY,
    )
    const fakeGateway = buildFakeExchangeGateway({ queryAgents: agentsWithLocalKey })
    const { result, rerender } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toBe('approved')

    // Simulate wallet disconnect — reset returns to the pre-bootstrap 'checking'
    // state (not 'missing'), so a reconnect re-enters the bootstrap window.
    setAuthState({ ready: false, authenticated: false, walletReady: false })
    rerender()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toBe('checking')
    expect(result.current.agentAddress).toBeNull()
  })

  // SEC-M1: the plaintext agent private key must NOT survive logout/disconnect.
  it('wipes the plaintext agent key from localStorage on wallet disconnect (SEC-M1)', async () => {
    localStorage.setItem(makeStorageKey(mockPrimaryWalletAddress, NETWORK), VALID_KEY)
    // A stale key from another account on the same (shared) browser must go too.
    const OTHER = '0x9999000000000000000000000000000000000099'
    localStorage.setItem(makeStorageKey(OTHER, NETWORK), VALID_KEY)
    const fakeGateway = buildFakeExchangeGateway({ queryAgents: agentsWithLocalKey })
    const { result, rerender } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toBe('approved')
    expect(localStorage.getItem(makeStorageKey(mockPrimaryWalletAddress, NETWORK))).toBe(VALID_KEY)

    // Disconnect — the agent-key localStorage entries are purged (clearAll).
    setAuthState({ ready: false, authenticated: false, walletReady: false })
    rerender()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(localStorage.getItem(makeStorageKey(mockPrimaryWalletAddress, NETWORK))).toBeNull()
    expect(localStorage.getItem(makeStorageKey(OTHER, NETWORK))).toBeNull()
  })

  it('does NOT wipe the native agent key when only the Selected Wallet master switches mid-session', async () => {
    // The native-keyed agent must survive a master switch (no disconnect) — the
    // wipe is a logout concern, not a re-key one. Guards the onDisconnect seam.
    localStorage.setItem(makeStorageKey(mockPrimaryWalletAddress, NETWORK), VALID_KEY)
    const fakeGateway = buildFakeExchangeGateway({
      queryAgents: (master: WalletAddress) =>
        master.toLowerCase() === mockPrimaryWalletAddress.toLowerCase()
          ? agentsWithLocalKey()
          : emptyAgents(),
    })
    const { result, rerender } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toBe('approved')

    const SWITCHED_MASTER = '0xabcabcab00000000000000000000000000000002' as WalletAddress
    setSelectedWallet({ masterAddress: SWITCHED_MASTER })
    rerender()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    // Master switched; the native key is UNTOUCHED (no logout occurred).
    expect(localStorage.getItem(makeStorageKey(mockPrimaryWalletAddress, NETWORK))).toBe(VALID_KEY)
  })

  it('does not include a "privateKey" key in the returned AgentWalletState', async () => {
    localStorage.setItem(
      makeStorageKey(mockPrimaryWalletAddress, NETWORK),
      VALID_KEY,
    )
    const fakeGateway = buildFakeExchangeGateway({ queryAgents: agentsWithLocalKey })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect('privateKey' in result.current).toBe(false)
  })

  it('transitions to { kind: "error", reason: "keystore-write-after-approval" } when approveAgent resolves ok but localStorage.setItem throws (#167 split)', async () => {
    setAuthState({
      getMasterViemAccount: async () => ({
        address: '0xmaster',
        signTypedData: async function fakeSign() { return '0x' },
      } as never),
    })
    const fakeGateway = buildFakeExchangeGateway({
      approveAgent: () => okAsync(undefined),
      queryAgents: emptyAgents,
    })
    const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError')
    })

    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    let approveResult!: { isErr: () => boolean }
    await act(async () => {
      approveResult = await result.current.approve('test-agent')
    })

    setItemSpy.mockRestore()

    expect(approveResult.isErr()).toBe(true)
    expect(result.current.status).toEqual({
      kind: 'error',
      reason: 'keystore-write-after-approval',
    })
  })

  // -------------------------------------------------------------------------
  // Phase 07 Plan 01 — deposit-required threading through agent provider (DEP-02)
  // -------------------------------------------------------------------------

  it('transitions to { kind: "error", reason: "deposit-required" } when gateway returns deposit-required (must NOT collapse to unknown)', async () => {
    setAuthState({
      getMasterViemAccount: async () => ({
        address: '0xmaster',
        signTypedData: async function fakeSign() { return '0x' },
      } as never),
    })
    const fakeGateway = buildFakeExchangeGateway({
      approveAgent: () =>
        errAsync(new HyperliquidGatewayError('deposit-required', 'Deposit required')),
      queryAgents: emptyAgents,
    })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    await act(async () => {
      await result.current.approve('test-agent')
    })
    expect(result.current.status).toEqual({ kind: 'error', reason: 'deposit-required' })
  })

  // -------------------------------------------------------------------------
  // ADR-0061 — ONE agent per account, keyed on the NATIVE wallet; the selected
  // master grants access. The key + name key on `nativeAddress`; `queryAgents`
  // + the grant key on `masterAddress`. Switching the selected wallet re-grants
  // the SAME native-keyed agent (no proliferation) and never mints a new key.
  // -------------------------------------------------------------------------

  const SELECTED_WALLET_ADDRESS =
    '0xabcabcab00000000000000000000000000000002' as WalletAddress
  const OTHER_NATIVE_ADDRESS =
    '0xdddd000000000000000000000000000000000003' as WalletAddress

  it('keys the agent KEY lookup on the NATIVE address, not the selected master (ADR-0061)', async () => {
    // The selected master differs from native; the key lives under NATIVE. If the
    // hook still keyed on the selected master it would read 'missing'.
    setSelectedWallet({ masterAddress: SELECTED_WALLET_ADDRESS, nativeAddress: OTHER_NATIVE_ADDRESS })
    localStorage.setItem(makeStorageKey(OTHER_NATIVE_ADDRESS, NETWORK), VALID_KEY)
    const fakeGateway = buildFakeExchangeGateway({ queryAgents: agentsWithLocalKey })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toBe('approved')
    // A key stored under the SELECTED master is NOT what was used.
    expect(localStorage.getItem(makeStorageKey(SELECTED_WALLET_ADDRESS, NETWORK))).toBeNull()
  })

  it('queries on-chain agents for the Selected Wallet master address (the grant lives there)', async () => {
    setSelectedWallet({ masterAddress: SELECTED_WALLET_ADDRESS })
    const queryAgentsSpy = vi.fn(emptyAgents)
    const fakeGateway = buildFakeExchangeGateway({ queryAgents: queryAgentsSpy })
    renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(queryAgentsSpy).toHaveBeenCalledWith(SELECTED_WALLET_ADDRESS)
  })

  it('switching the selected master keeps the SAME native key; readiness follows the new master grant', async () => {
    // The account has ONE native-keyed agent (under the native address). The
    // default master (== native) has granted it; the other master has not.
    localStorage.setItem(makeStorageKey(mockPrimaryWalletAddress, NETWORK), VALID_KEY)
    const fakeGateway = buildFakeExchangeGateway({
      // Grant exists only on the default master; the SELECTED master has no grant.
      queryAgents: (master: WalletAddress) =>
        master.toLowerCase() === mockPrimaryWalletAddress.toLowerCase()
          ? agentsWithLocalKey()
          : emptyAgents(),
    })
    const { result, rerender } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toBe('approved')

    // Switch the selected master — the native key is unchanged; readiness now
    // reflects whether THIS master has granted our agent (it hasn't → 'missing').
    setSelectedWallet({ masterAddress: SELECTED_WALLET_ADDRESS })
    rerender()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toBe('missing')

    // The account's single native-keyed agent is UNTOUCHED — no proliferation.
    expect(localStorage.getItem(makeStorageKey(mockPrimaryWalletAddress, NETWORK))).toBe(
      VALID_KEY,
    )
  })

  it('approve() always MINTS a fresh key even when one is stored — HL anti-replay (ADR-0077)', async () => {
    // The account already has a stored native key, but Hyperliquid bans re-approving
    // a previously-used agent address. So approve() must mint a FRESH keypair, never
    // reuse the stored one (the reverted ADR-0061 D-1). Proliferation stays bounded
    // by the stable native-keyed NAME (ADR-0061 D-2 / ADR-0036 D-1), not the key.
    const STORED_KEY = ('0x' + 'c'.repeat(64)) as `0x${string}`
    localStorage.setItem(makeStorageKey(mockPrimaryWalletAddress, NETWORK), STORED_KEY)
    setAuthState({
      getMasterViemAccount: async () =>
        ({ address: '0xmaster', signTypedData: async () => '0x' }) as never,
    })
    // Holder object so TS doesn't narrow a `let` to `null` across the callback.
    const captured: { agentAddress: string | null } = { agentAddress: null }
    const fakeGateway = buildFakeExchangeGateway({
      queryAgents: emptyAgents, // this master has not granted our agent → missing
      approveAgent: (_master: unknown, agentAddress: string) => {
        captured.agentAddress = agentAddress
        return okAsync(undefined)
      },
    })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toBe('missing')

    vi.mocked(generatePrivateKey).mockClear()
    await act(async () => {
      await result.current.approve('test-agent')
    })

    // A fresh keypair WAS minted (the old reuse path would short-circuit generatePrivateKey)...
    expect(vi.mocked(generatePrivateKey)).toHaveBeenCalledTimes(1)
    // ...so the grant authorized the FRESH key's address, NOT the stored key's.
    expect(captured.agentAddress?.toLowerCase()).toBe(VALID_KEY_AGENT_ADDRESS)
    // The freshly minted key is now persisted under the native address (overwrites the old).
    expect(localStorage.getItem(makeStorageKey(mockPrimaryWalletAddress, NETWORK))).toBe(VALID_KEY)
  })

  it('approve() MINTS a new native key only when the account has none', async () => {
    // No stored key → approve generates one and persists it under the NATIVE address.
    setAuthState({
      getMasterViemAccount: async () =>
        ({ address: '0xmaster', signTypedData: async () => '0x' }) as never,
    })
    const fakeGateway = buildFakeExchangeGateway({
      approveAgent: () => okAsync(undefined),
      queryAgents: emptyAgents,
    })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toBe('missing')

    vi.mocked(generatePrivateKey).mockClear()
    await act(async () => {
      await result.current.approve('test-agent')
    })

    expect(vi.mocked(generatePrivateKey)).toHaveBeenCalledTimes(1)
    // Persisted under the NATIVE address (== mockPrimaryWalletAddress here).
    expect(localStorage.getItem(makeStorageKey(mockPrimaryWalletAddress, NETWORK))).toBe(VALID_KEY)
  })

  it('approve() returns signing-unavailable when the selected wallet is not connectable (master null) — never signs as Native', async () => {
    // Fix 3: a picked-but-not-connected imported wallet resolves masterAddress to
    // null. Approve must NOT silently sign as the Native wallet.
    setSelectedWallet({ masterAddress: null })
    const approveAgentSpy = vi.fn(() => okAsync(undefined))
    const fakeGateway = buildFakeExchangeGateway({
      approveAgent: approveAgentSpy,
      queryAgents: emptyAgents,
    })
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    let approveResult!: { isErr: () => boolean; error?: { kind: string } }
    await act(async () => {
      approveResult = (await result.current.approve('test-agent')) as never
    })
    // The grant errors out and — critically — approveAgent is NEVER called, so we
    // never silently sign as the Native wallet for a not-connected selection.
    expect(approveResult.isErr()).toBe(true)
    expect(approveResult.error?.kind).toBe('signing-unavailable')
    expect(approveAgentSpy).not.toHaveBeenCalled()
  })
})
