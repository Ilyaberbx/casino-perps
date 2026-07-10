import { describe, expect, it } from 'vitest'
import type { Market } from '@/modules/shared/domain'
import type { VenueOnboardingStep } from '@/modules/shared/domain/venue-onboarding'
import {
  buildBetDraft,
  defaultOnboardingValues,
  directionToSide,
  formatLiquidationSentence,
  marginToSize,
  positionSideToDirection,
  resolveConfirmCta,
  sizeLotDecimals,
} from '../casino-trade.utils'

/** A perp market whose `stepSize = 10^-szDecimals` yields the given lot precision. */
function marketWith(overrides: Partial<Market> = {}): Market {
  return {
    symbol: 'BTC-PERP',
    baseAsset: 'BTC',
    quoteAsset: 'USDC',
    venue: 'hl',
    tickSize: 0.5,
    stepSize: 0.001, // szDecimals = 3
    marketType: 'perp',
    ...overrides,
  }
}

describe('marginToSize (D18: margin → coin size)', () => {
  it('converts margin × leverage / mark into coin size', () => {
    // $50 margin at 10x on a $100 mark = $500 notional = 5 coins.
    expect(marginToSize(50, 10, 100, 3)).toBe(5)
  })

  it('opens the documented $500 notional from a $50 chip at 10x', () => {
    const size = marginToSize(50, 10, 100, 3)
    expect(size * 100).toBe(500) // notional, never displayed
  })

  it('snaps DOWN to the market lot precision (szDecimals)', () => {
    // raw = (50 * 10) / 3 = 166.666… ; szDecimals 3 → 166.666
    expect(marginToSize(50, 10, 3, 3)).toBe(166.666)
    // same margin at szDecimals 0 (whole-coin lots) → 166
    expect(marginToSize(50, 10, 3, 0)).toBe(166)
    // szDecimals 2 → 166.66
    expect(marginToSize(50, 10, 3, 2)).toBe(166.66)
  })

  it('never spends more margin than the chip (never rounds up)', () => {
    // Rounding UP here would open 167 coins × $3 = $501 notional — $50.10 of
    // margin from a $50 chip, which a MAX bet cannot cover.
    const MARK = 3
    const BET = 50
    const LEVERAGE = 10
    const size = marginToSize(BET, LEVERAGE, MARK, 0)
    const marginSpent = (size * MARK) / LEVERAGE
    expect(marginSpent).toBeLessThanOrEqual(BET)
  })

  it('recovers szDecimals from the market stepSize', () => {
    expect(sizeLotDecimals(marketWith({ stepSize: 0.001 }))).toBe(3)
    expect(sizeLotDecimals(marketWith({ stepSize: 0.01 }))).toBe(2)
    expect(sizeLotDecimals(marketWith({ stepSize: 1 }))).toBe(0)
  })

  it('collapses non-positive / non-finite inputs to 0', () => {
    expect(marginToSize(0, 10, 100, 3)).toBe(0)
    expect(marginToSize(50, 0, 100, 3)).toBe(0)
    expect(marginToSize(50, 10, 0, 3)).toBe(0)
    expect(marginToSize(50, 10, Number.NaN, 3)).toBe(0)
    expect(marginToSize(-50, 10, 100, 3)).toBe(0)
  })
})

describe('formatLiquidationSentence (D16: liquidation as prose)', () => {
  const market = marketWith({ baseAsset: 'BTC', stepSize: 0.001 })

  it('says DROPS BELOW for an UP bet', () => {
    expect(formatLiquidationSentence('up', 94102, market)).toBe(
      'You lose this bet if BTC drops below $94,102',
    )
  })

  it('says RISES ABOVE for a DOWN bet', () => {
    expect(formatLiquidationSentence('down', 114880, market)).toBe(
      'You lose this bet if BTC rises above $114,880',
    )
  })

  it('degrades honestly when the liquidation is unknown', () => {
    expect(formatLiquidationSentence('up', 0, market)).toBe(
      'You lose this bet if BTC moves too far against you',
    )
    expect(formatLiquidationSentence('down', Number.NaN, market)).toBe(
      'You lose this bet if BTC moves too far against you',
    )
  })
})

describe('resolveConfirmCta (D6: confirm-sheet gating)', () => {
  const base = { isConnected: true, hasBalance: true, isSettingUp: false, isPlacing: false }

  it('becomes ADD CASH when the user has no balance', () => {
    expect(resolveConfirmCta({ ...base, hasBalance: false })).toBe('add-cash')
  })

  it('asks to connect first when no wallet, even without balance', () => {
    expect(resolveConfirmCta({ ...base, isConnected: false, hasBalance: false })).toBe('connect')
  })

  it('shows the silent setup loader while onboarding runs', () => {
    expect(resolveConfirmCta({ ...base, isSettingUp: true })).toBe('setting-up')
  })

  it('shows the placing loader while the order is in flight', () => {
    expect(resolveConfirmCta({ ...base, isPlacing: true })).toBe('placing')
  })

  it('is placeable when connected, funded, and idle', () => {
    expect(resolveConfirmCta(base)).toBe('place-bet')
  })
})

describe('direction mapping', () => {
  it('maps UP → buy and DOWN → sell', () => {
    expect(directionToSide('up')).toBe('buy')
    expect(directionToSide('down')).toBe('sell')
  })

  it('maps a long → UP and a short → DOWN', () => {
    expect(positionSideToDirection('long')).toBe('up')
    expect(positionSideToDirection('short')).toBe('down')
  })
})

describe('buildBetDraft', () => {
  it('builds a coin-unit market IOC draft carrying the converted size', () => {
    const draft = buildBetDraft({ symbol: 'BTC-PERP', direction: 'up', size: 5, leverage: 10 })
    expect(draft.orderType).toBe('market')
    expect(draft.side).toBe('buy')
    expect(draft.sizeUnit).toBe('coin')
    expect(draft.sizeInput).toBe('5')
    expect(draft.leverage).toBe(10)
    expect(draft.reduceOnly).toBe(false)
  })

  it('builds a sell draft for a DOWN bet', () => {
    const draft = buildBetDraft({ symbol: 'ETH-PERP', direction: 'down', size: 2, leverage: 5 })
    expect(draft.side).toBe('sell')
  })
})

describe('defaultOnboardingValues (D6: no-form silent onboarding)', () => {
  it('harvests each step input default (agent name included)', () => {
    const steps: VenueOnboardingStep[] = [
      {
        id: 'deposit',
        label: 'Deposit',
        description: '',
        status: 'complete',
      },
      {
        id: 'agent',
        label: 'Agent',
        description: '',
        status: 'pending',
        inputs: [
          {
            kind: 'text',
            id: 'agentName',
            label: 'Name',
            minLength: 1,
            maxLength: 16,
            defaultValue: 'casino-perps',
          },
        ],
      },
      {
        id: 'terms',
        label: 'Terms',
        description: '',
        status: 'pending',
        inputs: [
          { kind: 'checkbox', id: 'accept', label: 'Accept', required: true },
          {
            kind: 'select',
            id: 'region',
            label: 'Region',
            options: [
              { value: 'us', label: 'US' },
              { value: 'eu', label: 'EU' },
            ],
          },
        ],
      },
    ]
    expect(defaultOnboardingValues(steps)).toEqual({
      agentName: 'casino-perps',
      accept: 'true',
      region: 'us',
    })
  })

  it('is empty when no step carries inputs', () => {
    const steps: VenueOnboardingStep[] = [
      { id: 'deposit', label: 'Deposit', description: '', status: 'complete' },
    ]
    expect(defaultOnboardingValues(steps)).toEqual({})
  })
})
