import { describe, it, expect } from 'vitest'
import type { AgentApprovalErrorReason } from '../../agent-wallet-provider/agent-wallet-provider.types'
import type { BuilderFeeApprovalErrorReason } from '../../builder-fee-provider/builder-fee-provider.types'
import type { DepositErrorReason } from '../../deposit-provider/deposit-provider.types'
import {
  mapAgentErrorReasonToStatus,
  mapBuilderErrorReasonToStatus,
  mapDepositErrorReasonToStatus,
} from '../error-to-cta-mapping'

const ALL_AGENT_REASONS: ReadonlyArray<AgentApprovalErrorReason> = [
  'wallet-rejected',
  'chain-mismatch',
  'signing-unavailable',
  'corrupted-key',
  'agent-slots-full',
  'name-collision',
  'rate-limited',
  'deposit-required',
  'agent-exists-no-local-key',
  'keystore-write-after-approval',
  'agent-address-reused',
  'unknown',
]

const ALL_BUILDER_REASONS: ReadonlyArray<BuilderFeeApprovalErrorReason> = [
  'wallet-rejected',
  'chain-mismatch',
  'signing-unavailable',
  'builder-not-funded',
  'deposit-required',
  'approval-cap-reached',
  'rate-limited',
  'unknown',
]

describe('mapAgentErrorReasonToStatus — every reason maps to a non-empty status', () => {
  for (const reason of ALL_AGENT_REASONS) {
    it(`maps ${reason}`, () => {
      const status = mapAgentErrorReasonToStatus(reason)
      expect(status.kind).toBe('error')
      expect(status.reason).toBe(reason)
      expect(status.headline.length).toBeGreaterThan(0)
      expect(status.copy.length).toBeGreaterThan(0)
      expect(status.cta).toBeDefined()
    })
  }
})

describe('mapBuilderErrorReasonToStatus — every reason maps to a non-empty status', () => {
  for (const reason of ALL_BUILDER_REASONS) {
    it(`maps ${reason}`, () => {
      const status = mapBuilderErrorReasonToStatus(reason)
      expect(status.kind).toBe('error')
      expect(status.reason).toBe(reason)
      expect(status.headline.length).toBeGreaterThan(0)
      expect(status.copy.length).toBeGreaterThan(0)
      expect(status.cta).toBeDefined()
    })
  }
})

describe('per-reason CTA shape', () => {
  it('wallet-rejected → retry', () => {
    const status = mapAgentErrorReasonToStatus('wallet-rejected')
    expect(status.cta).toEqual({ kind: 'retry' })
    expect(status.copy.toLowerCase()).toContain('cancel')
  })

  it('chain-mismatch → switch-network with target chain id and name', () => {
    const status = mapAgentErrorReasonToStatus('chain-mismatch')
    expect(status.cta.kind).toBe('switch-network')
    if (status.cta.kind !== 'switch-network') throw new Error('expected switch-network')
    expect(status.cta.targetChainId).toBe(42161)
    expect(status.cta.chainName).toBe('Arbitrum One')
  })

  it('builder-not-funded → retry CTA', () => {
    const status = mapBuilderErrorReasonToStatus('builder-not-funded')
    expect(status.cta).toEqual({ kind: 'retry' })
    expect(status.copy.toLowerCase()).toContain('our side')
  })

  // ADR-0036 D-4: the builder cap is recovered in-house — the step renders the
  // revoke picker and the CTA fires the revoke→approve chain. No external link.
  it('approval-cap-reached → labelled retry (revoke picker), NOT an external link', () => {
    const status = mapBuilderErrorReasonToStatus('approval-cap-reached')
    expect(status.cta.kind).toBe('retry')
    if (status.cta.kind !== 'retry') throw new Error('expected retry')
    expect(status.cta.label).toBe('Revoke & approve')
    expect(status.copy.toLowerCase()).toContain('revoke')
  })

  // ADR-0036 D-3: agent slots-full is recovered in-house via the victim picker.
  it('agent-slots-full → labelled retry (victim picker), NOT an external link', () => {
    const status = mapAgentErrorReasonToStatus('agent-slots-full')
    expect(status.cta.kind).toBe('retry')
    if (status.cta.kind !== 'retry') throw new Error('expected retry')
    expect(status.cta.label).toBe('Replace selected agent')
    expect(status.copy.toLowerCase()).toContain('replace')
  })

  it('name-collision → retry', () => {
    const status = mapAgentErrorReasonToStatus('name-collision')
    expect(status.cta).toEqual({ kind: 'retry' })
    expect(status.copy.toLowerCase()).toContain('different label')
  })

  it('rate-limited → retry "wait" copy', () => {
    const status = mapAgentErrorReasonToStatus('rate-limited')
    expect(status.cta).toEqual({ kind: 'retry' })
    expect(status.copy.toLowerCase()).toContain('wait')
  })

  it('signing-unavailable → reconnect-wallet', () => {
    const status = mapAgentErrorReasonToStatus('signing-unavailable')
    expect(status.cta).toEqual({ kind: 'reconnect-wallet' })
  })

  it('corrupted-key → reset-local-state with confirm copy', () => {
    const status = mapAgentErrorReasonToStatus('corrupted-key')
    expect(status.cta.kind).toBe('reset-local-state')
    if (status.cta.kind !== 'reset-local-state') throw new Error('expected reset-local-state')
    expect(status.cta.confirmCopy.length).toBeGreaterThan(0)
  })

  it('unknown → retry with generic copy', () => {
    const status = mapAgentErrorReasonToStatus('unknown')
    expect(status.cta).toEqual({ kind: 'retry' })
    expect(status.headline.toLowerCase()).toContain('approval failed')
  })

  // ADR-0036 D-1/D-2: stale own agent → one-click same-name replace, in-house.
  it('agent-exists-no-local-key → labelled retry (one-click replace), NOT an external link', () => {
    const status = mapAgentErrorReasonToStatus('agent-exists-no-local-key')
    expect(status.cta.kind).toBe('retry')
    if (status.cta.kind !== 'retry') throw new Error('expected retry')
    expect(status.cta.label).toBe('Replace agent')
    expect(status.copy.toLowerCase()).toContain('replace')
  })

  // ADR-0077: HL anti-replay → self-healing labelled retry (approve() mints fresh).
  it('agent-address-reused → labelled retry that self-heals, NOT the opaque unknown copy', () => {
    const status = mapAgentErrorReasonToStatus('agent-address-reused')
    expect(status.cta.kind).toBe('retry')
    if (status.cta.kind !== 'retry') throw new Error('expected retry')
    expect(status.cta.label).toBe('Replace agent')
    expect(status.copy.toLowerCase()).toContain('fresh')
    expect(status.headline).not.toBe('Approval failed')
  })

  it('keystore-write-after-approval → reload-page CTA with replacement-aware copy (ADR-0036 D-6)', () => {
    const status = mapAgentErrorReasonToStatus('keystore-write-after-approval')
    expect(status.cta).toEqual({ kind: 'reload-page' })
    expect(status.copy.toLowerCase()).toContain('reload')
    expect(status.copy.toLowerCase()).toContain('replacement')
  })

  // ADR-0036 D-5: the "no external hand-offs" property is structural — no
  // reason in either union may map to an external-link CTA.
  it('NO agent or builder reason maps to an external-link CTA', () => {
    for (const reason of ALL_AGENT_REASONS) {
      expect(mapAgentErrorReasonToStatus(reason).cta.kind).not.toBe('external-link')
    }
    for (const reason of ALL_BUILDER_REASONS) {
      expect(mapBuilderErrorReasonToStatus(reason).cta.kind).not.toBe('external-link')
    }
  })
})

describe('causeChain pass-through', () => {
  it('agent mapping preserves causeChain', () => {
    const status = mapAgentErrorReasonToStatus('unknown', ' → root cause')
    expect(status.causeChain).toBe(' → root cause')
  })

  it('builder mapping preserves causeChain', () => {
    const status = mapBuilderErrorReasonToStatus('unknown', ' → root cause')
    expect(status.causeChain).toBe(' → root cause')
  })
})

// -------------------------------------------------------------------------
// Phase 07 Plan 01 — deposit-required CTA mapping (DEP-03)
// -------------------------------------------------------------------------

describe('deposit-required CTA — user-action funding copy with in-app open-deposit', () => {
  it('mapAgentErrorReasonToStatus("deposit-required") → cta.kind is open-deposit', () => {
    const status = mapAgentErrorReasonToStatus('deposit-required')
    expect(status.kind).toBe('error')
    expect(status.reason).toBe('deposit-required')
    expect(status.cta.kind).toBe('open-deposit')
  })

  it('mapAgentErrorReasonToStatus("deposit-required") → cta carries a label (no external href)', () => {
    const status = mapAgentErrorReasonToStatus('deposit-required')
    if (status.cta.kind !== 'open-deposit') throw new Error('expected open-deposit')
    expect(status.cta.label.length).toBeGreaterThan(0)
  })

  it('mapAgentErrorReasonToStatus("deposit-required") → copy contains "deposit" (user-action framing)', () => {
    const status = mapAgentErrorReasonToStatus('deposit-required')
    expect(status.copy.toLowerCase()).toContain('deposit')
  })

  it('mapBuilderErrorReasonToStatus("deposit-required") → cta.kind is open-deposit', () => {
    const status = mapBuilderErrorReasonToStatus('deposit-required')
    expect(status.kind).toBe('error')
    expect(status.reason).toBe('deposit-required')
    expect(status.cta.kind).toBe('open-deposit')
  })

  it('mapBuilderErrorReasonToStatus("deposit-required") → cta carries a label (no external href)', () => {
    const status = mapBuilderErrorReasonToStatus('deposit-required')
    if (status.cta.kind !== 'open-deposit') throw new Error('expected open-deposit')
    expect(status.cta.label.length).toBeGreaterThan(0)
  })

  it('mapBuilderErrorReasonToStatus("deposit-required") → copy contains "deposit" (user-action framing)', () => {
    const status = mapBuilderErrorReasonToStatus('deposit-required')
    expect(status.copy.toLowerCase()).toContain('deposit')
  })

  it('deposit-required copy is different from builder-not-funded copy (not the ops message)', () => {
    const depositStatus = mapAgentErrorReasonToStatus('deposit-required')
    const builderStatus = mapBuilderErrorReasonToStatus('builder-not-funded')
    expect(depositStatus.headline).not.toBe(builderStatus.headline)
    expect(depositStatus.copy).not.toBe(builderStatus.copy)
  })
})

// -------------------------------------------------------------------------
// Phase 07 Plan 04 — mapDepositErrorReasonToStatus (HIGH-2, DEP-05)
// -------------------------------------------------------------------------

const ALL_DEPOSIT_REASONS: ReadonlyArray<DepositErrorReason> = [
  'deposit-required',
  'rate-limited',
  'unknown',
]

describe('mapDepositErrorReasonToStatus — every reason maps to a non-empty status', () => {
  for (const reason of ALL_DEPOSIT_REASONS) {
    it(`maps ${reason}`, () => {
      const status = mapDepositErrorReasonToStatus(reason)
      expect(status.kind).toBe('error')
      expect(status.reason).toBe(reason)
      expect(status.headline.length).toBeGreaterThan(0)
      expect(status.copy.length).toBeGreaterThan(0)
      expect(status.cta).toBeDefined()
    })
  }
})

describe('mapDepositErrorReasonToStatus — deposit-required CTA is open-deposit', () => {
  it('deposit-required → kind is error with open-deposit CTA (HIGH-1 mechanism, in-app)', () => {
    const status = mapDepositErrorReasonToStatus('deposit-required')
    expect(status.kind).toBe('error')
    expect(status.reason).toBe('deposit-required')
    expect(status.cta.kind).toBe('open-deposit')
  })

  it('deposit-required → cta carries an in-app label (no external href)', () => {
    const status = mapDepositErrorReasonToStatus('deposit-required')
    if (status.cta.kind !== 'open-deposit') throw new Error('expected open-deposit')
    expect(status.cta.label.length).toBeGreaterThan(0)
  })

  it('deposit-required → copy contains "deposit" (user-action framing, not ops-side)', () => {
    const status = mapDepositErrorReasonToStatus('deposit-required')
    expect(status.copy.toLowerCase()).toContain('deposit')
  })

  it('rate-limited → also returns kind:error', () => {
    const status = mapDepositErrorReasonToStatus('rate-limited')
    expect(status.kind).toBe('error')
    expect(status.reason).toBe('rate-limited')
  })

  it('unknown → also returns kind:error', () => {
    const status = mapDepositErrorReasonToStatus('unknown')
    expect(status.kind).toBe('error')
    expect(status.reason).toBe('unknown')
  })
})

describe('mapDepositErrorReasonToStatus — causeChain pass-through', () => {
  it('preserves causeChain when provided', () => {
    const status = mapDepositErrorReasonToStatus('deposit-required', ' → root cause')
    expect(status.causeChain).toBe(' → root cause')
  })

  it('causeChain is undefined when not provided', () => {
    const status = mapDepositErrorReasonToStatus('deposit-required')
    expect(status.causeChain).toBeUndefined()
  })
})
