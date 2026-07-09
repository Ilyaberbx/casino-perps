import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { okAsync, errAsync } from 'neverthrow'
import {
  HYPERLIQUID_VENUE_ID,
  HYPERLIQUID_VENUE_LABEL,
} from '../../../hyperliquid.constants'
import { AgentApprovalError } from '../../agent-wallet-provider/agent-wallet-provider.types'
import { BuilderFeeApprovalError } from '../../builder-fee-provider/builder-fee-provider.types'
import { useOwnHyperliquidVenueOnboarding } from '../use-own-hyperliquid-venue-onboarding'
import {
  HYPERLIQUID_AGENT_NAME_INPUT_ID,
  HYPERLIQUID_STEP_AGENT_ID,
  HYPERLIQUID_STEP_BUILDER_ID,
} from '../hyperliquid-onboarding-provider.types'
import {
  buildFakeAgentState,
  buildFakeBuilderState,
  buildFakeDepositState,
  FAKE_PRIMARY_ADDRESS,
} from '../__fixtures__/fake-provider-states'
import {
  HYPERLIQUID_STEP_DEPOSIT_ID,
} from '../hyperliquid-onboarding-provider.types'

const defaultAuthState = {
  ready: true,
  authenticated: true,
  walletReady: true,
  primaryWalletAddress: FAKE_PRIMARY_ADDRESS,
  getMasterViemAccount: async () => null,
  getBroadcastWalletClient: async () => null,
  createAgentWallet: async () => ({ address: '0x0000000000000000000000000000000000000000', walletId: 'w' }),
  attachAgentSigner: async () => true,
  removeAgentSigner: async () => true,
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

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))
vi.mock('@/modules/account', () => ({
  useAuth: useAuthMock,
  useOnboardingFlow: vi.fn(() => ({ kind: 'ready', me: {} as never })),
  // ADR-0061: the default agent name is keyed on the Native address. Mirror it to
  // the primary so the expected `agent-<last4>` label is unchanged.
  useSelectedWallet: vi.fn(() => ({
    selectedAddress: null,
    masterAddress: FAKE_PRIMARY_ADDRESS,
    nativeAddress: FAKE_PRIMARY_ADDRESS,
    isSelectionConnectable: true,
  })),
  useIsWalletConnected: () => {
    const a = useAuthMock()
    return a.ready && a.authenticated && a.walletReady
  },
}))

import { useAuth } from '@/modules/account'

useAuthMock.mockReturnValue(defaultAuthState)

function setAuth(overrides: Partial<typeof defaultAuthState>) {
  vi.mocked(useAuth).mockReturnValue({ ...defaultAuthState, ...overrides } as never)
}

beforeEach(() => {
  setAuth({})
})

describe('useOwnHyperliquidVenueOnboarding — port shape', () => {
  it('exposes venue id + label + step ids in order deposit → agent → builder', () => {
    const agent = buildFakeAgentState({ status: 'missing' })
    const builder = buildFakeBuilderState({ status: 'missing' })
    const deposit = buildFakeDepositState({ status: 'funded' })
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({ agent, builder, deposit }),
    )

    expect(result.current.venueId).toBe(HYPERLIQUID_VENUE_ID)
    expect(result.current.venueLabel).toBe(HYPERLIQUID_VENUE_LABEL)
    expect(result.current.steps.map((s) => s.id)).toEqual([
      HYPERLIQUID_STEP_DEPOSIT_ID,
      HYPERLIQUID_STEP_AGENT_ID,
      HYPERLIQUID_STEP_BUILDER_ID,
    ])
  })

  it('deposit step has no capability (D-9 capability-less)', () => {
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState(),
        builder: buildFakeBuilderState(),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    const depositStep = result.current.steps[0]
    expect(depositStep.capability).toBeUndefined()
  })

  it('agent step ships a text input with default agent-<last4>', () => {
    const agent = buildFakeAgentState()
    const builder = buildFakeBuilderState()
    const deposit = buildFakeDepositState({ status: 'funded' })
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({ agent, builder, deposit }),
    )
    // agent is now steps[1] (deposit is steps[0])
    const agentStep = result.current.steps[1]
    const input = agentStep.inputs?.[0]
    expect(input).toMatchObject({
      kind: 'text',
      id: HYPERLIQUID_AGENT_NAME_INPUT_ID,
      defaultValue: 'agent-0001',
    })
  })

  it('builder step has no inputs and capability route-fees', () => {
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState(),
        builder: buildFakeBuilderState(),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    // builder is now steps[2] (deposit is steps[0])
    const builderStep = result.current.steps[2]
    expect(builderStep.inputs).toBeUndefined()
    expect(builderStep.capability).toBe('route-fees')
  })
})

describe('useOwnHyperliquidVenueOnboarding — status transitions', () => {
  it('returns bootstrapping when wallet is not ready', () => {
    setAuth({ walletReady: false })
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState(),
        builder: buildFakeBuilderState(),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    expect(result.current.status).toBe('bootstrapping')
  })

  // Reload regression: while any step's initial bootstrap query is still in
  // flight ('checking'), the venue must stay 'bootstrapping' rather than leaking
  // a transient 'incomplete' — that transient is what flickered the progress
  // badge and fired a false "setup complete" toast on reload of an already-
  // onboarded account.
  it('stays bootstrapping while the agent step is still checking (no incomplete leak)', () => {
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ status: 'checking' }),
        builder: buildFakeBuilderState({ status: 'approved' }),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    expect(result.current.status).toBe('bootstrapping')
  })

  it('stays bootstrapping while the builder step is still checking (no incomplete leak)', () => {
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ status: 'approved' }),
        builder: buildFakeBuilderState({ status: 'checking' }),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    expect(result.current.status).toBe('bootstrapping')
  })

  it('stays bootstrapping while the deposit step is still checking (no incomplete leak)', () => {
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ status: 'approved' }),
        builder: buildFakeBuilderState({ status: 'approved' }),
        deposit: buildFakeDepositState({ status: 'checking' }),
      }),
    )
    expect(result.current.status).toBe('bootstrapping')
  })

  it('returns incomplete when wallet is ready and ≥1 step pending', () => {
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ status: 'missing' }),
        builder: buildFakeBuilderState({ status: 'missing' }),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    expect(result.current.status).toBe('incomplete')
  })

  it('returns ready only when all three steps complete (deposit + agent + builder)', () => {
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ status: 'approved' }),
        builder: buildFakeBuilderState({ status: 'approved' }),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    expect(result.current.status).toBe('ready')
  })

  it('deposit needs-deposit → deposit step status is error-status with open-deposit CTA (HIGH-1, in-app)', () => {
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ status: 'approved' }),
        builder: buildFakeBuilderState({ status: 'approved' }),
        deposit: buildFakeDepositState({ status: 'needs-deposit' }),
      }),
    )
    const depositStep = result.current.steps[0]
    const stepStatus = depositStep.status
    expect(typeof stepStatus).toBe('object')
    if (typeof stepStatus !== 'object') throw new Error('expected error status object')
    expect(stepStatus.kind).toBe('error')
    expect(stepStatus.cta.kind).toBe('open-deposit')
    if (stepStatus.cta.kind !== 'open-deposit') throw new Error('expected open-deposit')
    expect(stepStatus.cta.label.length).toBeGreaterThan(0)
  })

  it('deposit query-error ({kind:error,reason}) → deposit step status is error-status (kind:error)', () => {
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ status: 'approved' }),
        builder: buildFakeBuilderState({ status: 'approved' }),
        deposit: buildFakeDepositState({ status: { kind: 'error', reason: 'deposit-required' } }),
      }),
    )
    const depositStep = result.current.steps[0]
    const stepStatus = depositStep.status
    expect(typeof stepStatus).toBe('object')
    if (typeof stepStatus !== 'object') throw new Error('expected error status object')
    expect(stepStatus.kind).toBe('error')
    expect(stepStatus.cta.kind).toBe('open-deposit')
  })

  it('deposit needs-deposit → venue composeStatus is incomplete (not blocked, not ready) even when agent+builder complete (D-10)', () => {
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ status: 'approved' }),
        builder: buildFakeBuilderState({ status: 'approved' }),
        deposit: buildFakeDepositState({ status: 'needs-deposit' }),
      }),
    )
    expect(result.current.status).toBe('incomplete')
    expect(typeof result.current.status).toBe('string')
  })

  it('deposit needs-deposit → venue status is never a blocked-kind object (D-10)', () => {
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ status: 'approved' }),
        builder: buildFakeBuilderState({ status: 'approved' }),
        deposit: buildFakeDepositState({ status: 'needs-deposit' }),
      }),
    )
    const venueStatus = result.current.status
    expect(typeof venueStatus).not.toBe('object')
  })

  it('agent error maps to step error with retry cta', () => {
    const agent = buildFakeAgentState({
      status: { kind: 'error', reason: 'unknown' },
    })
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent,
        builder: buildFakeBuilderState(),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    // agent is now steps[1] (deposit is steps[0])
    const agentStep = result.current.steps[1]
    const status = agentStep.status
    expect(typeof status).toBe('object')
    if (typeof status !== 'object') throw new Error('expected error status')
    expect(status.kind).toBe('error')
    expect(status.cta).toEqual({ kind: 'retry' })
  })
})

describe('useOwnHyperliquidVenueOnboarding — runAll', () => {
  it('runs agent then builder sequentially when deposit is funded', async () => {
    const order: string[] = []
    const agentApprove = vi.fn(() => {
      order.push('agent')
      return okAsync(undefined)
    })
    const builderApprove = vi.fn(() => {
      order.push('builder')
      return okAsync(undefined)
    })
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ approve: agentApprove }),
        builder: buildFakeBuilderState({ approve: builderApprove }),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )

    await act(async () => {
      const r = await result.current.runAll({})
      expect(r.isOk()).toBe(true)
    })

    expect(order).toEqual(['agent', 'builder'])
  })

  it('deposit not complete → runAll hard-stops before agent or builder (T-07-11)', async () => {
    const agentApprove = vi.fn(() => okAsync(undefined))
    const builderApprove = vi.fn(() => okAsync(undefined))
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ approve: agentApprove }),
        builder: buildFakeBuilderState({ approve: builderApprove }),
        deposit: buildFakeDepositState({ status: 'needs-deposit' }),
      }),
    )
    await act(async () => {
      const r = await result.current.runAll({})
      expect(r.isErr()).toBe(true)
    })
    expect(agentApprove).not.toHaveBeenCalled()
    expect(builderApprove).not.toHaveBeenCalled()
  })

  it('skips agent when already complete and proceeds to builder', async () => {
    const agentApprove = vi.fn(() => okAsync(undefined))
    const builderApprove = vi.fn(() => okAsync(undefined))
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ status: 'approved', approve: agentApprove }),
        builder: buildFakeBuilderState({ approve: builderApprove }),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    await act(async () => {
      await result.current.runAll({})
    })
    expect(agentApprove).not.toHaveBeenCalled()
    expect(builderApprove).toHaveBeenCalledTimes(1)
  })

  it('short-circuits on agent error — does not call builder', async () => {
    const agentApprove = vi.fn(() =>
      errAsync(new AgentApprovalError('unknown', 'boom')),
    )
    const builderApprove = vi.fn(() => okAsync(undefined))
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ approve: agentApprove }),
        builder: buildFakeBuilderState({ approve: builderApprove }),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    await act(async () => {
      const r = await result.current.runAll({})
      expect(r.isErr()).toBe(true)
      if (r.isErr()) expect(r.error.stepId).toBe(HYPERLIQUID_STEP_AGENT_ID)
    })
    expect(builderApprove).not.toHaveBeenCalled()
  })

  it('passes the agent label from values to the agent approve call', async () => {
    const agentApprove = vi.fn(() => okAsync(undefined))
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ approve: agentApprove }),
        builder: buildFakeBuilderState({ status: 'approved' }),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    await act(async () => {
      await result.current.runAll({ [HYPERLIQUID_AGENT_NAME_INPUT_ID]: 'my-bot' })
    })
    expect(agentApprove).toHaveBeenCalledWith('my-bot')
  })

  it('falls back to default agent name when input value is empty', async () => {
    const agentApprove = vi.fn(() => okAsync(undefined))
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ approve: agentApprove }),
        builder: buildFakeBuilderState({ status: 'approved' }),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    await act(async () => {
      await result.current.runAll({})
    })
    expect(agentApprove).toHaveBeenCalledWith('agent-0001')
  })

  it('does not re-fire builder approve when builder is already complete (CR-01 — no double-sign)', async () => {
    // CR-01 regression: the per-leg completeness pre-check is the guard that
    // prevents a second `approveBuilderFee` (which would burn another on-chain
    // signature — the action is NOT idempotent). With builder already approved,
    // runAll must run only the agent leg and skip the builder approve entirely.
    const agentApprove = vi.fn(() => okAsync(undefined))
    const builderApprove = vi.fn(() => okAsync(undefined))
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ status: 'missing', approve: agentApprove }),
        builder: buildFakeBuilderState({ status: 'approved', approve: builderApprove }),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    await act(async () => {
      const r = await result.current.runAll({})
      expect(r.isOk()).toBe(true)
    })
    expect(agentApprove).toHaveBeenCalledTimes(1)
    expect(builderApprove).not.toHaveBeenCalled()
  })

  it('isRunning ref blocks concurrent runAll', async () => {
    let resolveAgent: ((v: void) => void) = () => {}
    const deferred = new Promise<void>((r) => {
      resolveAgent = r
    })
    const agentApprove = vi.fn(() => okAsync(deferred).map(() => undefined))
    const builderApprove = vi.fn(() => okAsync(undefined))

    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ approve: agentApprove }),
        builder: buildFakeBuilderState({ approve: builderApprove }),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )

    let first: ReturnType<typeof result.current.runAll> | null = null
    await act(async () => {
      first = result.current.runAll({})
      const second = await result.current.runAll({})
      expect(second.isErr()).toBe(true)
      if (second.isErr()) expect(second.error.reason).toBe('busy')
    })
    resolveAgent()
    await act(async () => {
      await first
    })
  })
})

describe('useOwnHyperliquidVenueOnboarding — retryStep', () => {
  it('retryStep(agent) re-fires only agent approve', async () => {
    const agentApprove = vi.fn(() => okAsync(undefined))
    const builderApprove = vi.fn(() => okAsync(undefined))
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({
          status: { kind: 'error', reason: 'unknown' },
          approve: agentApprove,
        }),
        builder: buildFakeBuilderState({ approve: builderApprove }),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )

    await act(async () => {
      await result.current.retryStep(HYPERLIQUID_STEP_AGENT_ID, {})
    })
    expect(agentApprove).toHaveBeenCalledTimes(1)
    expect(builderApprove).not.toHaveBeenCalled()
  })

  it('retryStep(builder) re-fires only builder approve', async () => {
    const agentApprove = vi.fn(() => okAsync(undefined))
    const builderApprove = vi.fn(() => okAsync(undefined))
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ status: 'approved', approve: agentApprove }),
        builder: buildFakeBuilderState({
          status: { kind: 'error', reason: 'unknown' },
          approve: builderApprove,
        }),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    await act(async () => {
      await result.current.retryStep(HYPERLIQUID_STEP_BUILDER_ID, {})
    })
    expect(agentApprove).not.toHaveBeenCalled()
    expect(builderApprove).toHaveBeenCalledTimes(1)
  })

  it('retryStep(deposit) calls deposit.recheck and does NOT call agent or builder approve (T-07-12)', async () => {
    const recheck = vi.fn()
    const agentApprove = vi.fn(() => okAsync(undefined))
    const builderApprove = vi.fn(() => okAsync(undefined))
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ approve: agentApprove }),
        builder: buildFakeBuilderState({ approve: builderApprove }),
        deposit: buildFakeDepositState({ status: 'needs-deposit', recheck }),
      }),
    )
    await act(async () => {
      const r = await result.current.retryStep(HYPERLIQUID_STEP_DEPOSIT_ID, {})
      expect(r.isOk()).toBe(true)
    })
    expect(recheck).toHaveBeenCalledTimes(1)
    expect(agentApprove).not.toHaveBeenCalled()
    expect(builderApprove).not.toHaveBeenCalled()
  })

  it('retryStep with unknown step id returns VenueOnboardingError', async () => {
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState(),
        builder: buildFakeBuilderState(),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    await act(async () => {
      const r = await result.current.retryStep('nope', {})
      expect(r.isErr()).toBe(true)
      if (r.isErr()) expect(r.error.reason).toBe('unknown-step')
    })
  })

  it('builder approve error maps to VenueOnboardingError with builder step id', async () => {
    const builderApprove = vi.fn(() =>
      errAsync(new BuilderFeeApprovalError('unknown', 'boom')),
    )
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ status: 'approved' }),
        builder: buildFakeBuilderState({ approve: builderApprove }),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    await act(async () => {
      const r = await result.current.retryStep(HYPERLIQUID_STEP_BUILDER_ID, {})
      expect(r.isErr()).toBe(true)
      if (r.isErr()) expect(r.error.stepId).toBe(HYPERLIQUID_STEP_BUILDER_ID)
    })
  })
})

// ---------------------------------------------------------------------------
// ADR-0036 — in-house slot recovery (victim pickers + replace legs)
// ---------------------------------------------------------------------------

describe('useOwnHyperliquidVenueOnboarding — agent slots-full picker (ADR-0036 D-3)', () => {
  const ROSTER = [
    { address: '0x1111111111111111111111111111111111111111' as never, name: 'bot-a', validUntil: 1786579200000 },
    { address: '0x2222222222222222222222222222222222222222' as never, name: 'bot-b', validUntil: 1786579200000 },
    { address: '0x3333333333333333333333333333333333333333' as never, name: 'bot-c', validUntil: 1786579200000 },
  ]

  function slotsFullAgent(overrides: Parameters<typeof buildFakeAgentState>[0] = {}) {
    return buildFakeAgentState({
      status: { kind: 'error', reason: 'agent-slots-full' },
      existingAgents: ROSTER,
      ...overrides,
    })
  }

  it('replaces the agent text input with a select listing name + ISO expiry', () => {
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: slotsFullAgent(),
        builder: buildFakeBuilderState(),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    const agentStep = result.current.steps[1]
    expect(agentStep.inputs).toHaveLength(1)
    const input = agentStep.inputs?.[0]
    expect(input?.kind).toBe('select')
    if (input?.kind !== 'select') throw new Error('expected select input')
    expect(input.options.map((o) => o.value)).toEqual(['bot-a', 'bot-b', 'bot-c'])
    expect(input.options[0]?.label).toBe('bot-a — expires 2026-08-13')
  })

  it('falls back to the text input while existingAgents has not loaded', () => {
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: slotsFullAgent({ existingAgents: null }),
        builder: buildFakeBuilderState(),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    const input = result.current.steps[1].inputs?.[0]
    expect(input?.kind).toBe('text')
  })

  it('retryStep(agent) approves under the picked victim name (same-name replacement)', async () => {
    const agentApprove = vi.fn(() => okAsync(undefined))
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: slotsFullAgent({ approve: agentApprove }),
        builder: buildFakeBuilderState(),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    await act(async () => {
      await result.current.retryStep(HYPERLIQUID_STEP_AGENT_ID, {
        replaceAgentName: 'bot-b',
        [HYPERLIQUID_AGENT_NAME_INPUT_ID]: 'ignored-free-form-label',
      })
    })
    expect(agentApprove).toHaveBeenCalledWith('bot-b')
  })

  it('outside the slots-full state a stale replaceAgentName value is ignored', async () => {
    const agentApprove = vi.fn(() => okAsync(undefined))
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ status: 'missing', approve: agentApprove }),
        builder: buildFakeBuilderState(),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    await act(async () => {
      await result.current.retryStep(HYPERLIQUID_STEP_AGENT_ID, { replaceAgentName: 'bot-b' })
    })
    expect(agentApprove).toHaveBeenCalledWith('agent-0001')
  })
})

describe('useOwnHyperliquidVenueOnboarding — builder revoke picker (ADR-0036 D-4)', () => {
  const FOREIGN_A = '0x1111111111111111111111111111111111111111'
  const FOREIGN_B = '0x2222222222222222222222222222222222222222'

  function capBuilder(overrides: Parameters<typeof buildFakeBuilderState>[0] = {}) {
    return buildFakeBuilderState({
      status: { kind: 'error', reason: 'approval-cap-reached' },
      approvedBuilders: [FOREIGN_A as never, FOREIGN_B as never],
      ...overrides,
    })
  }

  it('attaches a full-address select to the builder step in the cap-rejected state', () => {
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ status: 'approved' }),
        builder: capBuilder(),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    const builderStep = result.current.steps[2]
    const input = builderStep.inputs?.[0]
    expect(input?.kind).toBe('select')
    if (input?.kind !== 'select') throw new Error('expected select input')
    expect(input.options.map((o) => o.value)).toEqual([FOREIGN_A, FOREIGN_B])
    expect(input.options[0]?.label).toBe(FOREIGN_A)
  })

  it('has no builder inputs outside the cap-rejected state', () => {
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ status: 'approved' }),
        builder: buildFakeBuilderState({ status: 'missing' }),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    expect(result.current.steps[2].inputs).toBeUndefined()
  })

  it('retryStep(builder) with a picked victim routes through replaceBuilder, not approve', async () => {
    const builderApprove = vi.fn(() => okAsync(undefined))
    const replaceBuilder = vi.fn(() => okAsync(undefined))
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ status: 'approved' }),
        builder: capBuilder({ approve: builderApprove, replaceBuilder }),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    await act(async () => {
      await result.current.retryStep(HYPERLIQUID_STEP_BUILDER_ID, {
        revokeBuilderAddress: FOREIGN_A,
      })
    })
    expect(replaceBuilder).toHaveBeenCalledWith(FOREIGN_A)
    expect(builderApprove).not.toHaveBeenCalled()
  })

  it('retryStep(builder) without the picker showing runs the plain approve (stale value ignored)', async () => {
    const builderApprove = vi.fn(() => okAsync(undefined))
    const replaceBuilder = vi.fn(() => okAsync(undefined))
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ status: 'approved' }),
        builder: buildFakeBuilderState({ status: 'missing', approve: builderApprove, replaceBuilder }),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    await act(async () => {
      await result.current.retryStep(HYPERLIQUID_STEP_BUILDER_ID, {
        revokeBuilderAddress: FOREIGN_A,
      })
    })
    expect(builderApprove).toHaveBeenCalledTimes(1)
    expect(replaceBuilder).not.toHaveBeenCalled()
  })

  it('runAll with a picked victim routes the builder leg through replaceBuilder', async () => {
    const agentApprove = vi.fn(() => okAsync(undefined))
    const builderApprove = vi.fn(() => okAsync(undefined))
    const replaceBuilder = vi.fn(() => okAsync(undefined))
    const { result } = renderHook(() =>
      useOwnHyperliquidVenueOnboarding({
        agent: buildFakeAgentState({ status: 'missing', approve: agentApprove }),
        builder: capBuilder({ approve: builderApprove, replaceBuilder }),
        deposit: buildFakeDepositState({ status: 'funded' }),
      }),
    )
    await act(async () => {
      await result.current.runAll({ revokeBuilderAddress: FOREIGN_B })
    })
    expect(agentApprove).toHaveBeenCalledTimes(1)
    expect(replaceBuilder).toHaveBeenCalledWith(FOREIGN_B)
    expect(builderApprove).not.toHaveBeenCalled()
  })
})
