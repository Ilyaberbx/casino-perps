import { describe, it, expect } from 'vitest'
import type { AccountActivityDelta } from '@/modules/shared/domain'
import { renderAccountActivityDelta } from '../account-activity-delta'

describe('renderAccountActivityDelta', () => {
  it('projects a deposit as Arbitrum → Hyperliquid USDC credit', () => {
    const row = renderAccountActivityDelta({ type: 'deposit', usdc: '5' })
    expect(row).toEqual({
      kind: 'deposit',
      action: 'Deposit',
      asset: 'USDC',
      from: 'Arbitrum',
      to: 'Hyperliquid',
      destination: null,
      changeAmount: 5,
      changeAsset: 'USDC',
      usdValue: 5,
      fee: null,
    })
  })

  it('projects a Spot → Perps account transfer as a positive change', () => {
    const row = renderAccountActivityDelta({
      type: 'accountClassTransfer',
      usdc: '11.8',
      toPerp: true,
    })
    expect(row.action).toBe('Account Transfer')
    expect(row.from).toBe('Spot')
    expect(row.to).toBe('Perps')
    expect(row.changeAmount).toBe(11.8)
    expect(row.usdValue).toBe(11.8)
  })

  it('projects a vault deposit with the HLP name + vault address destination', () => {
    const row = renderAccountActivityDelta({
      type: 'vaultDeposit',
      vault: '0xdfc24b077bc1425ad1dea75bcb6f8158e10df303',
      usdc: '11.8',
    })
    expect(row.action).toBe('Vault Deposit')
    expect(row.from).toBe('Perps')
    expect(row.to).toBe('HLP')
    expect(row.destination).toBe('0xdfc2…f303')
    expect(row.changeAmount).toBe(-11.8)
    expect(row.usdValue).toBe(11.8)
  })

  it('truncates a transfer destination to the checksummed head4…tail4 form', () => {
    const row = renderAccountActivityDelta({
      type: 'internalTransfer',
      user: '0x1111111111111111111111111111111111111111',
      destination: '0xabcdef0123456789abcdef0123456789abcdef12',
      usdc: '20',
      fee: '0',
    })
    // Canonical `formatWalletAddress`: checksummed `0x<head4>…<tail4>` (EIP-55
    // casing), not the old head6 lowercased form.
    expect(row.to).toBe('0xabcD…EF12')
    expect(row.destination).toBe('0xabcD…EF12')
  })

  it('formats the withdraw fee with its asset', () => {
    const row = renderAccountActivityDelta({
      type: 'withdraw',
      usdc: '100',
      nonce: 1,
      fee: '1',
    })
    expect(row.changeAmount).toBe(-100)
    expect(row.fee).toBe('1 USDC')
  })

  it('renders an unknown (SDK-unmodelled) delta kind without throwing', () => {
    // The live API returns `accountActivationGas`, which the pinned SDK type
    // does not model — it used to crash the panel via the throwing default.
    const drift = {
      type: 'accountActivationGas',
      amount: '0.03043121',
      token: 'HYPE',
    } as unknown as AccountActivityDelta

    const row = renderAccountActivityDelta(drift)

    expect(row.kind).toBe('accountActivationGas')
    expect(row.action).toBe('Account activation gas')
    expect(row.asset).toBe('HYPE')
    expect(row.changeAmount).toBeCloseTo(0.03043121)
    expect(row.changeAsset).toBe('HYPE')
  })

  it('falls back to dashes when an unknown kind has no amount/token', () => {
    const drift = { type: 'someFutureKind' } as unknown as AccountActivityDelta
    const row = renderAccountActivityDelta(drift)
    expect(row.action).toBe('Some future kind')
    expect(row.asset).toBe('--')
    expect(row.changeAmount).toBeNull()
    expect(row.usdValue).toBeNull()
  })
})
