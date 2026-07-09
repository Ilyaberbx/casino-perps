import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { WalletClient } from 'viem'
import type { ChainSwitchOutcome } from '@/modules/account'
import { HyperliquidDepositError } from '../../../services/hyperliquid-deposit-service.types'
import { useOwnDepositFlow, type DepositFlowDeps } from '../use-deposit-flow'
import {
  buildFakeDepositService,
  buildFakeFlowLogger,
  buildFakePortfolioReader,
  buildManualScheduler,
  buildSwitchMasterWalletChainStub,
  getBroadcastWalletClientStub,
  FAKE_ADDRESS,
  type FakeServiceOverrides,
} from '../__fixtures__/fake-deposit-flow-deps'

interface CapturedRecord {
  readonly level: string
  readonly fields: Record<string, unknown>
  readonly message: string
}

interface Harness {
  deps: DepositFlowDeps
  state: ReturnType<typeof buildFakeDepositService>['state']
  emit: (accountValue: number) => void
  setCurrent: (accountValue: number) => void
  tick: () => void
  isPolling: () => boolean
  records: CapturedRecord[]
  warnsFor: (message: string) => CapturedRecord[]
}

interface WalletReadiness {
  walletSource?: DepositFlowDeps['walletSource']
  isBroadcastWalletReady?: boolean
}

function makeDeps(
  serviceOverrides: FakeServiceOverrides = {},
  getBroadcastWalletClient: () => Promise<WalletClient | null> = getBroadcastWalletClientStub(),
  readiness: WalletReadiness = {},
  switchOutcome: ChainSwitchOutcome = 'switched',
): Harness {
  const { service, state } = buildFakeDepositService(serviceOverrides)
  const portfolio = buildFakePortfolioReader()
  const { logger, records } = buildFakeFlowLogger()
  const scheduler = buildManualScheduler()
  const { switchMasterWalletChain } = buildSwitchMasterWalletChainStub(switchOutcome)
  // Deterministic correlation ids: dep-1, dep-2, … so retry's fresh id is
  // assertable without a real crypto.randomUUID().
  let idCounter = 0
  const deps: DepositFlowDeps = {
    service,
    portfolioReader: portfolio.reader,
    address: FAKE_ADDRESS,
    getBroadcastWalletClient,
    switchMasterWalletChain,
    // Default: a ready external wallet — the common case once `wallets` has
    // hydrated, so the preflight runs immediately exactly as before this gate.
    walletSource: readiness.walletSource ?? 'external',
    isBroadcastWalletReady: readiness.isBroadcastWalletReady ?? true,
    logger,
    newDepositId: () => `dep-${(idCounter += 1)}`,
    setInterval: scheduler.setInterval,
    clearInterval: scheduler.clearInterval,
  }
  return {
    deps,
    state,
    emit: portfolio.emit,
    setCurrent: portfolio.setCurrent,
    tick: scheduler.tick,
    isPolling: scheduler.isActive,
    records,
    warnsFor: (message) =>
      records.filter((r) => r.level === 'warn' && r.message === message),
  }
}

describe('useOwnDepositFlow — pre-flight branching', () => {
  it('resolves to ready when funded, on Arbitrum, with gas', async () => {
    const h = makeDeps({ usdc: 100, ethForGas: 0.01, chainId: 42161 })
    const { result } = renderHook(() => useOwnDepositFlow(h.deps))
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    expect(result.current.walletUsdc).toBe(100)
  })

  it('resolves to needs-funding when USDC is below the minimum', async () => {
    const h = makeDeps({ usdc: 2, chainId: 42161 })
    const { result } = renderHook(() => useOwnDepositFlow(h.deps))
    await waitFor(() => expect(result.current.phase).toBe('needs-funding'))
  })

  it('resolves to wrong-chain when not on Arbitrum (chain takes precedence)', async () => {
    const h = makeDeps({ usdc: 100, chainId: 1 })
    const { result } = renderHook(() => useOwnDepositFlow(h.deps))
    await waitFor(() => expect(result.current.phase).toBe('wrong-chain'))
  })

  it('resolves to no-gas when funded on Arbitrum but ETH is zero', async () => {
    const h = makeDeps({ usdc: 100, ethForGas: 0, chainId: 42161 })
    const { result } = renderHook(() => useOwnDepositFlow(h.deps))
    await waitFor(() => expect(result.current.phase).toBe('no-gas'))
  })

  it('errors with unknown when balance read fails', async () => {
    const h = makeDeps({
      balanceReadOutcome: new HyperliquidDepositError('balance-read-failed', 'boom'),
    })
    const { result } = renderHook(() => useOwnDepositFlow(h.deps))
    await waitFor(() => expect(result.current.phase).toBe('error'))
    expect(result.current.errorReason).toBe('unknown')
  })
})

describe('useOwnDepositFlow — broadcast-wallet readiness gate', () => {
  it('waits in checking while an external wallet is still hydrating (no preflight, no abort)', async () => {
    const h = makeDeps({ usdc: 100, ethForGas: 0.01, chainId: 42161 }, getBroadcastWalletClientStub(), {
      walletSource: 'external',
      isBroadcastWalletReady: false,
    })
    const { result } = renderHook((d: DepositFlowDeps) => useOwnDepositFlow(d), {
      initialProps: h.deps,
    })
    // Flush the microtask the mount effect would have used to kick preflight.
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.phase).toBe('checking')
    // Gated out entirely: no preflight ran, so no first-open `wallet-unavailable`.
    expect(h.records.filter((r) => r.message === 'preflight start')).toHaveLength(0)
    expect(h.warnsFor('preflight aborted')).toHaveLength(0)
  })

  it('self-heals when the external wallet becomes ready — preflight runs and resolves', async () => {
    const h = makeDeps({ usdc: 100, ethForGas: 0.01, chainId: 42161 }, getBroadcastWalletClientStub(), {
      walletSource: 'external',
      isBroadcastWalletReady: false,
    })
    const { result, rerender } = renderHook((d: DepositFlowDeps) => useOwnDepositFlow(d), {
      initialProps: h.deps,
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.phase).toBe('checking')

    // The injected wallet hydrates into `wallets`: same service state, now ready.
    rerender({ ...h.deps, isBroadcastWalletReady: true })
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    expect(result.current.walletUsdc).toBe(100)
  })

  it('embedded-selected master proceeds through preflight (ADR-0060 — no wallet-unavailable abort)', async () => {
    // ADR-0060: the embedded Native wallet is now a valid broadcast master. With
    // a selected embedded master the broadcast accessor resolves (embedded is
    // always in `useWallets()`), so preflight runs the balance/chain/gas checks
    // and resolves a real branch — NOT the old `wallet-unavailable` abort. Here
    // the embedded wallet is funded on Arbitrum with gas → `ready`.
    const h = makeDeps({ usdc: 100, ethForGas: 0.01, chainId: 42161 }, getBroadcastWalletClientStub(), {
      walletSource: 'embedded',
      isBroadcastWalletReady: true,
    })
    const { result } = renderHook(() => useOwnDepositFlow(h.deps))
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    expect(result.current.walletUsdc).toBe(100)
    // No abort: the genuine preflight ran instead of bailing wallet-unavailable.
    expect(h.warnsFor('preflight aborted')).toHaveLength(0)
    expect(h.records.filter((r) => r.message === 'preflight start')).toHaveLength(1)
  })

  it('embedded-selected master with no gas hits the no-gas branch (ADR-0060 — not aborted)', async () => {
    // The embedded wallet reaches the existing no-gas/needs-funding/wrong-chain
    // branches like any other master; no embedded-specific gating is added.
    const h = makeDeps({ usdc: 100, ethForGas: 0, chainId: 42161 }, getBroadcastWalletClientStub(), {
      walletSource: 'embedded',
      isBroadcastWalletReady: true,
    })
    const { result } = renderHook(() => useOwnDepositFlow(h.deps))
    await waitFor(() => expect(result.current.phase).toBe('no-gas'))
    expect(h.warnsFor('preflight aborted')).toHaveLength(0)
  })
})

describe('useOwnDepositFlow — live-balance auto-advance', () => {
  it('polls in needs-funding and advances to ready when balance crosses the minimum', async () => {
    const h = makeDeps({ usdc: 0, chainId: 42161 })
    const { result } = renderHook(() => useOwnDepositFlow(h.deps))
    await waitFor(() => expect(result.current.phase).toBe('needs-funding'))
    expect(h.isPolling()).toBe(true)

    // funds arrive — next poll tick reads the new balance and auto-advances
    h.state.usdc = 25
    await act(async () => {
      h.tick()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    expect(result.current.walletUsdc).toBe(25)
  })

  it('stays in needs-funding while balance is still below the minimum', async () => {
    const h = makeDeps({ usdc: 0, chainId: 42161 })
    const { result } = renderHook(() => useOwnDepositFlow(h.deps))
    await waitFor(() => expect(result.current.phase).toBe('needs-funding'))

    h.state.usdc = 3
    await act(async () => {
      h.tick()
      await Promise.resolve()
    })
    expect(result.current.phase).toBe('needs-funding')
    expect(result.current.walletUsdc).toBe(3)
  })
})

describe('useOwnDepositFlow — chain switch', () => {
  it('re-resolves after a successful switch', async () => {
    const h = makeDeps({ usdc: 100, chainId: 1 })
    const { result } = renderHook(() => useOwnDepositFlow(h.deps))
    await waitFor(() => expect(result.current.phase).toBe('wrong-chain'))

    h.state.chainId = 42161
    await act(async () => {
      result.current.switchChain()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.phase).toBe('ready'))
  })

  it('surfaces an error when the switch resolves but the chain did not change (embedded no-op)', async () => {
    // switchMasterWalletChain resolves 'switched', but the chain stays on 1 — the
    // post-switch verify must catch it rather than looping on the button (ADR-0080).
    const h = makeDeps({ usdc: 100, chainId: 1 }, getBroadcastWalletClientStub(), {}, 'switched')
    const { result } = renderHook(() => useOwnDepositFlow(h.deps))
    await waitFor(() => expect(result.current.phase).toBe('wrong-chain'))

    await act(async () => {
      result.current.switchChain()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.phase).toBe('error'))
    expect(result.current.errorReason).toBe('chain-switch-failed')
  })

  it('returns non-destructively to wrong-chain when the switch is rejected', async () => {
    const h = makeDeps({ usdc: 100, chainId: 1 }, getBroadcastWalletClientStub(), {}, 'rejected')
    const { result } = renderHook(() => useOwnDepositFlow(h.deps))
    await waitFor(() => expect(result.current.phase).toBe('wrong-chain'))

    await act(async () => {
      result.current.switchChain()
      await Promise.resolve()
    })
    expect(result.current.phase).toBe('wrong-chain')
    expect(result.current.errorReason).toBeNull()
  })

  it('routes to error on a failed switch', async () => {
    const h = makeDeps({ usdc: 100, chainId: 1 }, getBroadcastWalletClientStub(), {}, 'failed')
    const { result } = renderHook(() => useOwnDepositFlow(h.deps))
    await waitFor(() => expect(result.current.phase).toBe('wrong-chain'))

    await act(async () => {
      result.current.switchChain()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.phase).toBe('error'))
    expect(result.current.errorReason).toBe('chain-switch-failed')
  })
})

describe('useOwnDepositFlow — submit + two-phase success', () => {
  async function reachReadyWithAmount(amount: string): Promise<{
    harness: Harness
    result: { current: ReturnType<typeof useOwnDepositFlow> }
  }> {
    const harness = makeDeps({ usdc: 100, ethForGas: 0.01, chainId: 42161 })
    const { result } = renderHook(() => useOwnDepositFlow(harness.deps))
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    await act(async () => {
      result.current.setAmount(amount)
    })
    return { harness, result }
  }

  it('signing → sent on a mined transfer, then credited when account value reaches the target', async () => {
    const { harness, result } = await reachReadyWithAmount('50')
    // Pre-broadcast baseline: 1000. With amount 50 and CREDIT_TOLERANCE 0.5 the
    // target is 1025 — captured BEFORE the transfer (CR-02).
    harness.setCurrent(1000)
    await act(async () => {
      result.current.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.phase).toBe('sent'))
    expect(result.current.transactionHash).toBe('0xfeed')

    // phase-2: account value rises past the target → credited.
    await act(async () => {
      harness.emit(1050)
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.phase).toBe('credited'))
  })

  it('does not credit on an unrelated rise that stays below the deposit target (CR-02 false-positive)', async () => {
    const { harness, result } = await reachReadyWithAmount('50')
    // baseline 1000, target 1025; a +10 unrelated PnL bump (→1010) must NOT credit.
    harness.setCurrent(1000)
    await act(async () => {
      result.current.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.phase).toBe('sent'))

    await act(async () => {
      harness.emit(1010)
      await Promise.resolve()
    })
    expect(result.current.phase).toBe('sent')
  })

  it('credits even when the deposit lands BEFORE the first post-sent snapshot (CR-02 false-negative)', async () => {
    // The credit settles fast: by the time phase-2 subscribes, the live reader
    // already reports the post-credit value. With the old "first snapshot is the
    // baseline" logic this stranded the user on `sent` forever. The pre-broadcast
    // baseline capture means the very first post-sent snapshot already clears the
    // target and credits.
    const { harness, result } = await reachReadyWithAmount('50')
    harness.setCurrent(1000) // pre-broadcast baseline → target 1025
    await act(async () => {
      result.current.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.phase).toBe('sent'))

    // Deposit already credited before phase-2 subscribes: the reader's current
    // value is now 1100, emitted synchronously to the new subscriber.
    await act(async () => {
      harness.setCurrent(1100)
      harness.emit(1100)
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.phase).toBe('credited'))
  })

  it('returns to ready with the amount preserved when the transfer is rejected', async () => {
    const harness = makeDeps({
      usdc: 100,
      ethForGas: 0.01,
      chainId: 42161,
      transferOutcome: new HyperliquidDepositError('wallet-rejected', 'declined'),
    })
    const { result } = renderHook(() => useOwnDepositFlow(harness.deps))
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    await act(async () => {
      result.current.setAmount('40')
    })
    await act(async () => {
      result.current.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    expect(result.current.amount).toBe('40')
    expect(result.current.errorReason).toBeNull()
  })

  it('routes to error on a real transfer failure', async () => {
    const harness = makeDeps({
      usdc: 100,
      ethForGas: 0.01,
      chainId: 42161,
      transferOutcome: new HyperliquidDepositError('transfer-failed', 'reverted'),
    })
    const { result } = renderHook(() => useOwnDepositFlow(harness.deps))
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    await act(async () => {
      result.current.setAmount('40')
    })
    await act(async () => {
      result.current.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.phase).toBe('error'))
    expect(result.current.errorReason).toBe('transfer-failed')
  })

  it('blocks submit with insufficient-balance when the amount is invalid', async () => {
    const { result } = await reachReadyWithAmount('1') // below the 5 minimum
    await act(async () => {
      result.current.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.phase).toBe('error'))
    expect(result.current.errorReason).toBe('insufficient-balance')
  })
})

describe('useOwnDepositFlow — amount helpers', () => {
  it('setAmountToMax fills the wallet balance', async () => {
    const h = makeDeps({ usdc: 73.5, ethForGas: 0.01, chainId: 42161 })
    const { result } = renderHook(() => useOwnDepositFlow(h.deps))
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    await act(async () => {
      result.current.setAmountToMax()
    })
    expect(result.current.amount).toBe('73.5')
    expect(result.current.isAmountValid).toBe(true)
  })

  it('retry re-runs the pre-flight', async () => {
    const h = makeDeps({
      balanceReadOutcome: new HyperliquidDepositError('balance-read-failed', 'boom'),
    })
    const { result } = renderHook(() => useOwnDepositFlow(h.deps))
    await waitFor(() => expect(result.current.phase).toBe('error'))
    await act(async () => {
      result.current.retry()
      await Promise.resolve()
    })
    // still errors (the fake keeps failing) but it routed back through checking
    await waitFor(() => expect(result.current.phase).toBe('error'))
  })
})

describe('useOwnDepositFlow — log coverage', () => {
  it('warns with the real kind when the preflight balance read fails', async () => {
    const h = makeDeps({
      balanceReadOutcome: new HyperliquidDepositError('balance-read-failed', 'rpc down'),
    })
    const { result } = renderHook(() => useOwnDepositFlow(h.deps))
    await waitFor(() => expect(result.current.phase).toBe('error'))

    const [warn] = h.warnsFor('preflight balance read failed')
    expect(warn).toBeDefined()
    expect(warn.fields).toMatchObject({ kind: 'balance-read-failed', errorMessage: 'rpc down' })
    expect(warn.fields.depositId).toBe('dep-1')
  })

  it('warns but keeps polling when a funding-poll read fails (no silent swallow)', async () => {
    const h = makeDeps({ usdc: 0, chainId: 42161 })
    const { result } = renderHook(() => useOwnDepositFlow(h.deps))
    await waitFor(() => expect(result.current.phase).toBe('needs-funding'))

    // The read starts failing only now — a poll tick must surface it, not eat it.
    h.state.balanceReadError = new HyperliquidDepositError('balance-read-failed', 'poll boom')
    await act(async () => {
      h.tick()
      await Promise.resolve()
    })

    expect(h.warnsFor('funding poll read failed')).toHaveLength(1)
    // still polling — the failure did not tear the interval down
    expect(h.isPolling()).toBe(true)
    expect(result.current.phase).toBe('needs-funding')
  })

  it('warns on a real transfer failure', async () => {
    const h = makeDeps({
      usdc: 100,
      ethForGas: 0.01,
      chainId: 42161,
      transferOutcome: new HyperliquidDepositError('transfer-failed', 'reverted'),
    })
    const { result } = renderHook(() => useOwnDepositFlow(h.deps))
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    await act(async () => {
      result.current.setAmount('40')
    })
    await act(async () => {
      result.current.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.phase).toBe('error'))

    const [warn] = h.warnsFor('transfer failed')
    expect(warn).toBeDefined()
    expect(warn.fields).toMatchObject({ kind: 'transfer-failed', errorMessage: 'reverted' })
  })

  it('warns on a failed chain switch', async () => {
    const h = makeDeps({ usdc: 100, chainId: 1 }, getBroadcastWalletClientStub(), {}, 'failed')
    const { result } = renderHook(() => useOwnDepositFlow(h.deps))
    await waitFor(() => expect(result.current.phase).toBe('wrong-chain'))
    await act(async () => {
      result.current.switchChain()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.phase).toBe('error'))

    const [warn] = h.warnsFor('chain switch failed')
    expect(warn).toBeDefined()
    // The correlation id still binds the record (structured logging preserved).
    expect(warn.fields.depositId).toBe('dep-1')
  })

  it('surfaces the underlying cause (real RPC reason) in the balance-read warn', async () => {
    // The genuinely useful signal is the cause behind a balance-read-failed — a
    // 429 from the default public RPC, here — not the static "balanceOf failed".
    const rpcError = new Error('HTTP 429 Too Many Requests for 0xAbCdef0123456789012345678901234567890abc')
    const h = makeDeps({
      balanceReadOutcome: new HyperliquidDepositError(
        'balance-read-failed',
        'USDC balanceOf failed',
        rpcError,
      ),
    })
    const { result } = renderHook(() => useOwnDepositFlow(h.deps))
    await waitFor(() => expect(result.current.phase).toBe('error'))

    const [warn] = h.warnsFor('preflight balance read failed')
    expect(warn.fields.cause).toContain('429')
    // …and the address embedded in that cause is scrubbed, never raw.
    expect(warn.fields.cause).not.toContain('0xAbCdef0123456789012345678901234567890abc')
  })

  it('logs an error and reaches the error card when the wallet accessor throws', async () => {
    // A THROWING accessor (vs a returned null) must not vanish as an unhandled
    // rejection that strands the flow on `checking` — it logs + shows the card.
    const h = makeDeps({}, () => Promise.reject(new Error('wallet provider exploded')))
    const { result } = renderHook(() => useOwnDepositFlow(h.deps))
    await waitFor(() => expect(result.current.phase).toBe('error'))

    const [err] = h.records.filter((r) => r.level === 'error' && r.message === 'wallet accessor threw')
    expect(err).toBeDefined()
    expect(err.fields.errorMessage).toContain('wallet provider exploded')
    expect(result.current.errorReason).toBe('unknown')
  })

  it('mints a fresh depositId on retry so the new attempt is greppable on its own', async () => {
    const h = makeDeps({
      balanceReadOutcome: new HyperliquidDepositError('balance-read-failed', 'boom'),
    })
    const { result } = renderHook(() => useOwnDepositFlow(h.deps))
    await waitFor(() => expect(result.current.phase).toBe('error'))
    await act(async () => {
      result.current.retry()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.phase).toBe('error'))

    const ids = h.records.map((r) => r.fields.depositId)
    expect(ids).toContain('dep-1')
    // the retry's preflight logs under the new id, not the stale one
    expect(ids).toContain('dep-2')
  })
})
