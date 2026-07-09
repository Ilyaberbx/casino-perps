import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const useIsWalletConnectedMock = vi.fn<() => boolean>()
const useApiClientMock = vi.fn()

vi.mock('@/modules/account', () => ({
  useIsWalletConnected: () => useIsWalletConnectedMock(),
  useAuth: () => ({ apiClient: useApiClientMock() }),
}))

import { useAgentBalanceTile } from '../use-agent-balance-tile'
import { EMPTY_BALANCE_DISPLAY } from '../../../agent-balance.constants'
import {
  buildOkReader,
  buildErrReader,
  buildOkAgentWallet,
  buildErrAgentWallet,
} from '../__fixtures__/fakes'
import type { AgentWalletAddress } from '../../../agent-balance.types'

const AGENT_WALLET: AgentWalletAddress =
  '0x2222222222222222222222222222222222222222'

function setup(connected: boolean) {
  useIsWalletConnectedMock.mockReturnValue(connected)
  useApiClientMock.mockReturnValue({})
}

describe('useAgentBalanceTile', () => {
  it('returns $0.00 when disconnected', () => {
    setup(false)
    const { result } = renderHook(() =>
      useAgentBalanceTile({
        reader: buildOkReader(12.5),
        getAgentWallet: buildOkAgentWallet(AGENT_WALLET),
      }),
    )
    expect(result.current.display).toBe(EMPTY_BALANCE_DISPLAY)
  })

  it('returns $0.00 when connected but the agent wallet address is absent', async () => {
    setup(true)
    const { result } = renderHook(() =>
      useAgentBalanceTile({
        reader: buildOkReader(12.5),
        getAgentWallet: buildErrAgentWallet(),
      }),
    )
    // never resolves a balance — stays at the empty placeholder
    await waitFor(() => {
      expect(result.current.display).toBe(EMPTY_BALANCE_DISPLAY)
    })
  })

  it('returns formatUsd(balance) once a balance lands', async () => {
    setup(true)
    const { result } = renderHook(() =>
      useAgentBalanceTile({
        reader: buildOkReader(12.5),
        getAgentWallet: buildOkAgentWallet(AGENT_WALLET),
      }),
    )
    await waitFor(() => {
      expect(result.current.display).toBe('$12.50')
    })
  })

  it('stays at $0.00 when the balance read fails', async () => {
    setup(true)
    const { result } = renderHook(() =>
      useAgentBalanceTile({
        reader: buildErrReader(),
        getAgentWallet: buildOkAgentWallet(AGENT_WALLET),
      }),
    )
    await waitFor(() => {
      expect(result.current.display).toBe(EMPTY_BALANCE_DISPLAY)
    })
  })
})
