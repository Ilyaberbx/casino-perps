import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AgentBalanceSheetProvider } from '../../../providers/agent-balance-sheet'
import { useAgentBalanceSheet } from '../../../providers/agent-balance-sheet'
import { useAgentBalanceSheetContent } from '../use-agent-balance-sheet-content'
import type { AgentBalanceSheetContentDeps } from '../agent-wallet-modal.types'
import type { AgentWalletAddress } from '../../../agent-balance.types'

const useAuthMock = vi.fn()

vi.mock('@/modules/account', () => {
  // Recipient suggestions for the withdraw destination combobox — stubbed empty
  // (the wallet-list/localStorage sourcing is unit-tested in `account/`). Held as
  // one stable instance so `withdrawDeps`' memo identity survives re-renders
  // (mirrors production, where the hook returns memoized references).
  const recipientSuggestions = {
    walletSuggestions: [],
    recentSuggestions: [],
    recordRecipient: () => {},
  }
  return {
    useAuth: () => useAuthMock(),
    useRecipientSuggestions: () => recipientSuggestions,
  }
})

const AGENT_WALLET = '0x4444444444444444444444444444444444444444' as AgentWalletAddress
const CONNECTED_WALLET =
  '0x5555555555555555555555555555555555555555' as AgentWalletAddress

function setupAuth(overrides: Record<string, unknown> = {}) {
  useAuthMock.mockReturnValue({
    apiClient: {},
    primaryWalletAddress: CONNECTED_WALLET,
    // ADR-0082: the withdraw broadcast client resolves via the Agent Wallet's
    // OWN address, never the trading Selected Wallet — tests below assert it
    // is called with the Agent Wallet address, not `CONNECTED_WALLET`.
    getAgentWalletBroadcastClient: vi.fn().mockResolvedValue(null),
    switchMasterWalletChain: vi.fn().mockResolvedValue('switched'),
    isBroadcastWalletReady: true,
    attachAgentSigner: vi.fn().mockResolvedValue(true),
    removeAgentSigner: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  })
}

function wrapper({ children }: { children: ReactNode }) {
  return <AgentBalanceSheetProvider>{children}</AgentBalanceSheetProvider>
}

function renderContent(deps: AgentBalanceSheetContentDeps) {
  return renderHook(
    () => ({
      content: useAgentBalanceSheetContent(deps),
      sheet: useAgentBalanceSheet(),
    }),
    { wrapper },
  )
}

describe('useAgentBalanceSheetContent', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
  })

  it('starts closed (mode null) and does not read balances', () => {
    setupAuth()
    const readUsdcBalance = vi.fn().mockResolvedValue(0)
    const { result } = renderContent({
      getAgentWalletAddress: vi.fn().mockResolvedValue(AGENT_WALLET),
      readUsdcBalance,
    })
    expect(result.current.content.mode).toBeNull()
    expect(readUsdcBalance).not.toHaveBeenCalled()
  })

  it('on open resolves the agent wallet and reads its USDC into the withdraw cap', async () => {
    setupAuth()
    const readUsdcBalance = vi.fn(async (address: `0x${string}`) =>
      address === AGENT_WALLET ? 50 : 25,
    )
    const { result } = renderContent({
      getAgentWalletAddress: vi.fn().mockResolvedValue(AGENT_WALLET),
      readUsdcBalance,
    })

    act(() => result.current.sheet.openWithdraw())

    await waitFor(() => {
      expect(result.current.content.withdrawDeps.availableUsdc).toBe(50)
    })
    expect(result.current.content.depositDeps.agentWalletAddress).toBe(AGENT_WALLET)
  })

  it('exposes only the Agent Wallet address on the deposit deps (receive-only)', async () => {
    setupAuth()
    const { result } = renderContent({
      getAgentWalletAddress: vi.fn().mockResolvedValue(AGENT_WALLET),
      readUsdcBalance: vi.fn().mockResolvedValue(0),
    })

    act(() => result.current.sheet.openDeposit())

    await waitFor(() => {
      expect(result.current.content.depositDeps.agentWalletAddress).toBe(AGENT_WALLET)
    })
  })

  it('exposes a withdraw authorizer factory (explicit per-action path)', () => {
    setupAuth()
    const { result } = renderContent({})
    expect(typeof result.current.content.withdrawDeps.getWithdrawAuthorizer).toBe(
      'function',
    )
    // The factory builds an authorizer with an authorizeAndSend method.
    expect(
      typeof result.current.content.withdrawDeps
        .getWithdrawAuthorizer()
        .authorizeAndSend,
    ).toBe('function')
  })

  it('resolves the withdraw broadcast client from the Agent Wallet address, never the trading wallet', async () => {
    const getAgentWalletBroadcastClient = vi.fn().mockResolvedValue(null)
    setupAuth({ getAgentWalletBroadcastClient })
    const { result } = renderContent({
      getAgentWalletAddress: vi.fn().mockResolvedValue(AGENT_WALLET),
      readUsdcBalance: vi.fn().mockResolvedValue(50),
    })

    act(() => result.current.sheet.openWithdraw())
    await waitFor(() => expect(result.current.content.withdrawDeps.availableUsdc).toBe(50))

    await result.current.content.withdrawDeps.getWithdrawAuthorizer().authorizeAndSend(
      CONNECTED_WALLET,
      1,
    )

    expect(getAgentWalletBroadcastClient).toHaveBeenCalledWith(AGENT_WALLET)
    expect(getAgentWalletBroadcastClient).not.toHaveBeenCalledWith(CONNECTED_WALLET)
  })

  it('switches the Agent Wallet to Base and re-verifies via a fresh client', async () => {
    const switchMasterWalletChain = vi.fn().mockResolvedValue('switched')
    const getAgentWalletBroadcastClient = vi
      .fn()
      .mockResolvedValue({ getChainId: () => Promise.resolve(8453) })
    setupAuth({ switchMasterWalletChain, getAgentWalletBroadcastClient })
    const { result } = renderContent({
      getAgentWalletAddress: vi.fn().mockResolvedValue(AGENT_WALLET),
      readUsdcBalance: vi.fn().mockResolvedValue(0),
    })

    act(() => result.current.sheet.openWithdraw())
    await waitFor(() =>
      expect(result.current.content.depositDeps.agentWalletAddress).toBe(AGENT_WALLET),
    )

    const outcome = await result.current.content.withdrawDeps.switchToBase()

    expect(switchMasterWalletChain).toHaveBeenCalledWith(AGENT_WALLET, 8453)
    expect(outcome).toBe('switched')
  })

  it('reports failed when the re-verified chain does not match after a switch', async () => {
    const switchMasterWalletChain = vi.fn().mockResolvedValue('switched')
    const getAgentWalletBroadcastClient = vi
      .fn()
      .mockResolvedValue({ getChainId: () => Promise.resolve(42161) })
    setupAuth({ switchMasterWalletChain, getAgentWalletBroadcastClient })
    const { result } = renderContent({
      getAgentWalletAddress: vi.fn().mockResolvedValue(AGENT_WALLET),
      readUsdcBalance: vi.fn().mockResolvedValue(0),
    })

    act(() => result.current.sheet.openWithdraw())
    await waitFor(() =>
      expect(result.current.content.depositDeps.agentWalletAddress).toBe(AGENT_WALLET),
    )

    const outcome = await result.current.content.withdrawDeps.switchToBase()

    expect(outcome).toBe('failed')
  })

  it('builds delegation deps (recipient + status reader + grant port) from an injected recipient', () => {
    setupAuth()
    const { result } = renderContent({ delegationRecipient: CONNECTED_WALLET })

    expect(result.current.content.delegationDeps).not.toBeNull()
    expect(result.current.content.delegationDeps?.recipient).toBe(CONNECTED_WALLET)
    expect(typeof result.current.content.delegationDeps?.getStatus).toBe('function')
    expect(
      typeof result.current.content.delegationDeps?.getGrantPort().grant,
    ).toBe('function')
  })

  it('leaves delegation deps null when no recipient is configured', () => {
    setupAuth()
    const { result } = renderContent({ delegationRecipient: null })
    expect(result.current.content.delegationDeps).toBeNull()
  })

  // Regression (perf): the no-args default must be an identity-stable object, not
  // a fresh `{}` per render. A fresh default churns every `[deps]`-dependent
  // `useCallback` and re-fires the open-flow effect each render while the modal is
  // open. Calling the hook with NO args (the production path) and forcing an idle
  // re-render must leave the derived deps identity-stable.
  it('keeps deposit/withdraw deps identity-stable across an idle re-render (no args)', () => {
    setupAuth()
    const { result, rerender } = renderHook(
      () => useAgentBalanceSheetContent(),
      { wrapper },
    )

    const depositDepsBefore = result.current.depositDeps
    const withdrawDepsBefore = result.current.withdrawDeps

    // Idle re-render: nothing changes (no prop/state/auth change).
    rerender()

    expect(result.current.depositDeps).toBe(depositDepsBefore)
    expect(result.current.withdrawDeps).toBe(withdrawDepsBefore)
  })
})
