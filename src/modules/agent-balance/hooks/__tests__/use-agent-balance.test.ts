import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { ResultAsync } from 'neverthrow'

const useIsWalletConnectedMock = vi.fn<() => boolean>()
const useApiClientMock = vi.fn()
const useCreateAgentWalletMock = vi.fn()

vi.mock('@/modules/account', () => ({
  useIsWalletConnected: () => useIsWalletConnectedMock(),
  useAuth: () => ({
    apiClient: useApiClientMock(),
    createAgentWallet: useCreateAgentWalletMock(),
  }),
}))

import { useAgentBalance } from '../use-agent-balance'
import {
  buildOkReader,
  buildErrReader,
  buildOkAgentWallet,
  buildErrAgentWallet,
  buildNotRegisteredAgentWallet,
  buildOkCreateAgentWallet,
  buildErrCreateAgentWallet,
  buildOkRegisterAgentWallet,
} from '../../components/agent-balance-tile/__fixtures__/fakes'
import type {
  AgentWalletAddress,
  BaseUsdcBalanceReader,
} from '../../agent-balance.types'

const AGENT_WALLET: AgentWalletAddress =
  '0x2222222222222222222222222222222222222222'
const CREATED_WALLET: AgentWalletAddress =
  '0x3333333333333333333333333333333333333333'

function setup(connected: boolean) {
  useIsWalletConnectedMock.mockReturnValue(connected)
  useApiClientMock.mockReturnValue({})
  useCreateAgentWalletMock.mockReturnValue(buildOkCreateAgentWallet(CREATED_WALLET))
}

/** A reader whose read never resolves — holds the hook in the loading phase. */
function buildPendingReader(): BaseUsdcBalanceReader {
  return {
    readUsdcBalance: () =>
      ResultAsync.fromSafePromise(new Promise<number>(() => undefined)),
  }
}

describe('useAgentBalance — read status (slice 12)', () => {
  it('reports idle when disconnected', () => {
    setup(false)
    const { result } = renderHook(() =>
      useAgentBalance({
        reader: buildOkReader(12.5),
        getAgentWallet: buildOkAgentWallet(AGENT_WALLET),
      }),
    )
    expect(result.current.status).toBe('idle')
  })

  it('reports loading while the on-chain read is in flight', () => {
    setup(true)
    const { result } = renderHook(() =>
      useAgentBalance({
        reader: buildPendingReader(),
        getAgentWallet: buildOkAgentWallet(AGENT_WALLET),
      }),
    )
    expect(result.current.status).toBe('loading')
  })

  it('reports ready once a balance lands for a registered wallet', async () => {
    setup(true)
    const { result } = renderHook(() =>
      useAgentBalance({
        reader: buildOkReader(12.5),
        getAgentWallet: buildOkAgentWallet(AGENT_WALLET),
      }),
    )
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
      expect(result.current.display).toBe('$12.50')
      expect(result.current.agentWalletAddress).toBe(AGENT_WALLET)
    })
  })

  it('reports error when the balance read fails', async () => {
    setup(true)
    const { result } = renderHook(() =>
      useAgentBalance({
        reader: buildErrReader(),
        getAgentWallet: buildOkAgentWallet(AGENT_WALLET),
      }),
    )
    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
  })

  it('reports error when the agent wallet read fails (non-404)', async () => {
    setup(true)
    const { result } = renderHook(() =>
      useAgentBalance({
        reader: buildOkReader(12.5),
        getAgentWallet: buildErrAgentWallet(),
      }),
    )
    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
  })
})

describe('useAgentBalance — create + register on 404 (ADR-0078)', () => {
  it('creates a wallet, registers it, then reads its balance when not registered', async () => {
    setup(true)
    // Stable fake identities so the effect runs once (inline fakes churn deps).
    const reader = buildOkReader(7.25)
    const getAgentWallet = buildNotRegisteredAgentWallet()
    const createAgentWallet = vi.fn(buildOkCreateAgentWallet(CREATED_WALLET, 'wallet-123'))
    const registerAgentWallet = vi.fn(buildOkRegisterAgentWallet(CREATED_WALLET))
    const { result } = renderHook(() =>
      useAgentBalance({ reader, getAgentWallet, createAgentWallet, registerAgentWallet }),
    )

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
      expect(result.current.display).toBe('$7.25')
      expect(result.current.agentWalletAddress).toBe(CREATED_WALLET)
    })
    expect(createAgentWallet).toHaveBeenCalledTimes(1)
    expect(registerAgentWallet).toHaveBeenCalledWith({
      address: CREATED_WALLET,
      walletId: 'wallet-123',
    })
  })

  it('reports error when the create step throws', async () => {
    setup(true)
    const { result } = renderHook(() =>
      useAgentBalance({
        reader: buildOkReader(7.25),
        getAgentWallet: buildNotRegisteredAgentWallet(),
        createAgentWallet: buildErrCreateAgentWallet(),
        registerAgentWallet: buildOkRegisterAgentWallet(CREATED_WALLET),
      }),
    )
    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
  })
})
