import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { parseUnits } from 'viem'
import { useOwnEvmCoreFlow } from '../use-evm-core-flow'
import {
  buildEvmCoreDeps,
  EVM_CORE_ERROR,
  FAKE_EVM_TX_HASH,
  FAKE_HYPEREVM_CHAIN_ID,
  FAKE_MASTER_ADDRESS,
  HYPE_TOKEN,
  UBTC_SYSTEM_ADDRESS,
  UBTC_TOKEN,
} from '../__fixtures__/fake-evm-core-flow-deps'
import { HYPE_SYSTEM_ADDRESS } from '../evm-core-flow.constants'

describe('useOwnEvmCoreFlow — initial state', () => {
  it('starts Core→EVM on the form with the first token, applicable', () => {
    const h = buildEvmCoreDeps()
    const { result } = renderHook(() => useOwnEvmCoreFlow(h.deps))
    expect(result.current.flow.phase).toBe('form')
    expect(result.current.flow.direction).toBe('core-to-evm')
    expect(result.current.flow.symbol).toBe('BTC')
    expect(result.current.flow.available).toBe(2)
    expect(result.current.isApplicable).toBe(true)
  })

  it('isApplicable is false when no master resolves or no tokens are movable', () => {
    expect(renderHook(() => useOwnEvmCoreFlow(buildEvmCoreDeps({ masterAddress: null }).deps)).result.current.isApplicable).toBe(false)
    expect(renderHook(() => useOwnEvmCoreFlow(buildEvmCoreDeps({ coreTokens: [] }).deps)).result.current.isApplicable).toBe(false)
  })
})

describe('useOwnEvmCoreFlow — token + amount', () => {
  it('selecting a token switches the symbol/available and clears the amount', () => {
    const h = buildEvmCoreDeps()
    const { result } = renderHook(() => useOwnEvmCoreFlow(h.deps))
    act(() => result.current.flow.setAmount('1'))
    act(() => result.current.flow.selectToken(HYPE_TOKEN.key))
    expect(result.current.flow.symbol).toBe('HYPE')
    expect(result.current.flow.available).toBe(50)
    expect(result.current.flow.amount).toBe('')
  })

  it('MAX fills the available; review is gated on a valid amount', () => {
    const h = buildEvmCoreDeps()
    const { result } = renderHook(() => useOwnEvmCoreFlow(h.deps))
    expect(result.current.flow.canReview).toBe(false)
    act(() => result.current.flow.setAmountToMax())
    expect(result.current.flow.amount).toBe('2')
    expect(result.current.flow.canReview).toBe(true)
  })

  it('invalidates an amount above the available cap', () => {
    const h = buildEvmCoreDeps()
    const { result } = renderHook(() => useOwnEvmCoreFlow(h.deps))
    act(() => result.current.flow.setAmount('5'))
    expect(result.current.flow.isAmountValid).toBe(false)
    expect(result.current.flow.amountInvalidReason).toMatch(/exceeds/i)
  })
})

describe('useOwnEvmCoreFlow — submit routing', () => {
  it('a standard token routes spotSend to its index-derived system address', async () => {
    const h = buildEvmCoreDeps()
    const { result } = renderHook(() => useOwnEvmCoreFlow(h.deps))
    act(() => result.current.flow.setAmount('1'))
    act(() => result.current.flow.review())
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('sent'))
    expect(h.spotCalls).toEqual([
      { destination: UBTC_SYSTEM_ADDRESS, token: UBTC_TOKEN.tokenId, amount: '1' },
    ])
    expect(h.toast.payloads[0]?.variant).toBe('success')
    expect(h.successCount()).toBe(1)
  })

  it('HYPE routes spotSend to the special 0x2222…2222 address', async () => {
    const h = buildEvmCoreDeps()
    const { result } = renderHook(() => useOwnEvmCoreFlow(h.deps))
    act(() => result.current.flow.selectToken(HYPE_TOKEN.key))
    act(() => result.current.flow.setAmount('30'))
    act(() => result.current.flow.review())
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('sent'))
    expect(h.spotCalls).toEqual([
      { destination: HYPE_SYSTEM_ADDRESS, token: HYPE_TOKEN.tokenId, amount: '30' },
    ])
  })

  it('blocks submit with insufficient-balance when the amount exceeds the cap', async () => {
    const h = buildEvmCoreDeps({ coreTokens: [{ ...UBTC_TOKEN, available: 1 }] })
    const { result } = renderHook(() => useOwnEvmCoreFlow(h.deps))
    act(() => result.current.flow.setAmount('5'))
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('error'))
    expect(result.current.flow.errorReason).toBe('insufficient-balance')
    expect(h.spotCalls).toHaveLength(0)
  })

  it('errors with unknown when the master wallet cannot be resolved', async () => {
    const h = buildEvmCoreDeps({ masterWallet: null })
    const { result } = renderHook(() => useOwnEvmCoreFlow(h.deps))
    act(() => result.current.flow.setAmount('1'))
    act(() => result.current.flow.review())
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('error'))
    expect(result.current.flow.errorReason).toBe('unknown')
    expect(h.spotCalls).toHaveLength(0)
  })
})

describe('useOwnEvmCoreFlow — evm-to-core direction', () => {
  it('runs preflight to ready, then submits an ERC20 transfer to the system address', async () => {
    const h = buildEvmCoreDeps()
    const { result } = renderHook(() => useOwnEvmCoreFlow(h.deps))
    act(() => result.current.flow.setDirection('evm-to-core'))
    await waitFor(() => {
      expect(result.current.flow.evmPreflight).toBe('ready')
      expect(result.current.flow.available).toBe(10)
    })
    act(() => result.current.flow.setAmount('1'))
    act(() => result.current.flow.review())
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('sent'))
    expect(h.evmTransfers).toEqual([
      { kind: 'erc20', to: UBTC_SYSTEM_ADDRESS, rawAmount: parseUnits('1', 8) },
    ])
    expect(result.current.flow.transactionHash).toBe(FAKE_EVM_TX_HASH)
    expect(result.current.flow.explorerTxUrl).toContain(FAKE_EVM_TX_HASH)
  })

  it('routes HYPE through a native send to 0x2222…2222', async () => {
    const h = buildEvmCoreDeps()
    const { result } = renderHook(() => useOwnEvmCoreFlow(h.deps))
    act(() => result.current.flow.setDirection('evm-to-core'))
    act(() => result.current.flow.selectToken(HYPE_TOKEN.key))
    await waitFor(() => {
      expect(result.current.flow.evmPreflight).toBe('ready')
      expect(result.current.flow.available).toBe(1)
    })
    act(() => result.current.flow.setAmount('0.5'))
    act(() => result.current.flow.review())
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('sent'))
    expect(h.evmTransfers).toEqual([
      { kind: 'native', to: HYPE_SYSTEM_ADDRESS, rawAmount: parseUnits('0.5', 18) },
    ])
  })

  it('blocks on no-gas (cannot review) when the wallet holds no native HYPE', async () => {
    const h = buildEvmCoreDeps({ evm: { nativeBalance: 0 } })
    const { result } = renderHook(() => useOwnEvmCoreFlow(h.deps))
    act(() => result.current.flow.setDirection('evm-to-core'))
    await waitFor(() => expect(result.current.flow.evmPreflight).toBe('no-gas'))
    act(() => result.current.flow.setAmount('1'))
    expect(result.current.flow.canReview).toBe(false)
  })

  it('surfaces wrong-chain; a successful switch calls Privy with the HyperEVM id and clears the gate', async () => {
    const h = buildEvmCoreDeps({ evm: { chainId: 1 } })
    const { result } = renderHook(() => useOwnEvmCoreFlow(h.deps))
    act(() => result.current.flow.setDirection('evm-to-core'))
    await waitFor(() => expect(result.current.flow.evmPreflight).toBe('wrong-chain'))
    await act(async () => {
      result.current.flow.switchChain()
      await Promise.resolve()
    })
    expect(h.switchCalls).toEqual([{ master: FAKE_MASTER_ADDRESS, chainId: FAKE_HYPEREVM_CHAIN_ID }])
    // The switch actually changed the chain → the post-switch verify passes and the
    // preflight re-reads to `ready` (the amount form replaces the switch button).
    await waitFor(() => expect(result.current.flow.evmPreflight).toBe('ready'))
    expect(result.current.flow.phase).toBe('form')
  })

  it('a resolved-but-unchanged switch (embedded no-op) surfaces an error, not a silent loop', async () => {
    const h = buildEvmCoreDeps({ evm: { chainId: 1 }, switchChangesChain: false })
    const { result } = renderHook(() => useOwnEvmCoreFlow(h.deps))
    act(() => result.current.flow.setDirection('evm-to-core'))
    await waitFor(() => expect(result.current.flow.evmPreflight).toBe('wrong-chain'))
    await act(async () => {
      result.current.flow.switchChain()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('error'))
    expect(result.current.flow.errorReason).toBe('chain-switch-failed')
  })

  it('a rejected switch stays on wrong-chain non-destructively (no error card)', async () => {
    const h = buildEvmCoreDeps({ evm: { chainId: 1 }, switchOutcome: 'rejected' })
    const { result } = renderHook(() => useOwnEvmCoreFlow(h.deps))
    act(() => result.current.flow.setDirection('evm-to-core'))
    await waitFor(() => expect(result.current.flow.evmPreflight).toBe('wrong-chain'))
    await act(async () => {
      result.current.flow.switchChain()
      await Promise.resolve()
    })
    expect(result.current.flow.phase).toBe('form')
    await waitFor(() => expect(result.current.flow.evmPreflight).toBe('wrong-chain'))
  })

  it('a failed switch surfaces an error card', async () => {
    const h = buildEvmCoreDeps({ evm: { chainId: 1 }, switchOutcome: 'failed' })
    const { result } = renderHook(() => useOwnEvmCoreFlow(h.deps))
    act(() => result.current.flow.setDirection('evm-to-core'))
    await waitFor(() => expect(result.current.flow.evmPreflight).toBe('wrong-chain'))
    await act(async () => {
      result.current.flow.switchChain()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('error'))
    expect(result.current.flow.errorReason).toBe('chain-switch-failed')
  })
})

describe('useOwnEvmCoreFlow — gateway errors + recovery', () => {
  it('maps a gateway error and preserves input; retry returns to the form', async () => {
    const h = buildEvmCoreDeps({ sendOutcome: EVM_CORE_ERROR('network') })
    const { result } = renderHook(() => useOwnEvmCoreFlow(h.deps))
    act(() => result.current.flow.setAmount('1'))
    act(() => result.current.flow.review())
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('error'))
    expect(result.current.flow.errorReason).toBe('network')
    expect(h.toast.payloads).toHaveLength(0)
    act(() => result.current.flow.retry())
    expect(result.current.flow.phase).toBe('form')
    expect(result.current.flow.amount).toBe('1')
  })
})
