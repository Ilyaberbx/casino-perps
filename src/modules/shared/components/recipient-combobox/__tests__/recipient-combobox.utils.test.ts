import { describe, expect, it } from 'vitest'
import {
  buildRecentRecipientSuggestions,
  buildRecipientGroups,
  buildWalletRecipientSuggestions,
  clampActiveIndex,
  filterRecipientSuggestions,
} from '../recipient-combobox.utils'
import type { RecipientSuggestion, RecipientWallet } from '../recipient-combobox.types'

const NATIVE_ADDR = '0x1111111111111111111111111111111111111111'
const IMPORTED_ADDR = '0x2222222222222222222222222222222222222222'
const RECENT_ADDR = '0x3333333333333333333333333333333333333333'

function wallet(address: string, source: RecipientWallet['source']): RecipientWallet {
  return { address, source }
}

describe('buildWalletRecipientSuggestions', () => {
  it('labels Native over its address and imported by address over the source word', () => {
    const suggestions = buildWalletRecipientSuggestions(
      [wallet(NATIVE_ADDR, 'embedded'), wallet(IMPORTED_ADDR, 'imported')],
      null,
    )
    expect(suggestions).toEqual([
      { address: NATIVE_ADDR, title: 'Native', subtitle: '0x1111…1111' },
      { address: IMPORTED_ADDR, title: '0x2222…2222', subtitle: 'Imported' },
    ])
  })

  it('drops the self address case-insensitively when set', () => {
    const suggestions = buildWalletRecipientSuggestions(
      [wallet(NATIVE_ADDR, 'embedded'), wallet(IMPORTED_ADDR, 'imported')],
      NATIVE_ADDR.toUpperCase(),
    )
    expect(suggestions.map((s) => s.address)).toEqual([IMPORTED_ADDR])
  })

  it('keeps every wallet when selfAddress is null (Withdraw)', () => {
    const suggestions = buildWalletRecipientSuggestions([wallet(NATIVE_ADDR, 'embedded')], null)
    expect(suggestions.map((s) => s.address)).toEqual([NATIVE_ADDR])
  })
})

describe('buildRecentRecipientSuggestions', () => {
  it('maps recent addresses to title-only suggestions', () => {
    const suggestions = buildRecentRecipientSuggestions([RECENT_ADDR], [], null)
    expect(suggestions).toEqual([{ address: RECENT_ADDR, title: '0x3333…3333', subtitle: null }])
  })

  it('drops recents that are already own wallets or the self address', () => {
    const suggestions = buildRecentRecipientSuggestions(
      [IMPORTED_ADDR, NATIVE_ADDR, RECENT_ADDR],
      [wallet(IMPORTED_ADDR, 'imported')],
      NATIVE_ADDR,
    )
    expect(suggestions.map((s) => s.address)).toEqual([RECENT_ADDR])
  })
})

const WALLET_A: RecipientSuggestion = { address: NATIVE_ADDR, title: 'Native', subtitle: '0x11…11' }
const WALLET_B: RecipientSuggestion = {
  address: IMPORTED_ADDR,
  title: '0x22…22',
  subtitle: 'Imported',
}
const RECENT: RecipientSuggestion = { address: RECENT_ADDR, title: '0x33…33', subtitle: null }

describe('filterRecipientSuggestions', () => {
  it('returns the list unchanged for an empty query', () => {
    expect(filterRecipientSuggestions([WALLET_A, WALLET_B], '')).toEqual([WALLET_A, WALLET_B])
  })

  it('matches address, title, or subtitle case-insensitively', () => {
    expect(filterRecipientSuggestions([WALLET_A, WALLET_B], 'imported')).toEqual([WALLET_B])
    expect(filterRecipientSuggestions([WALLET_A, WALLET_B], 'native')).toEqual([WALLET_A])
    expect(filterRecipientSuggestions([WALLET_A, WALLET_B], '0x2222')).toEqual([WALLET_B])
  })
})

describe('buildRecipientGroups', () => {
  it('assembles both groups over one flat index space and marks the active row', () => {
    const { groups, flatCount } = buildRecipientGroups([WALLET_A, WALLET_B], [RECENT], 2)
    expect(flatCount).toBe(3)
    expect(groups.map((g) => g.heading)).toEqual(['Your wallets', 'Recent'])
    const flat = groups.flatMap((g) => g.options)
    expect(flat.map((o) => o.index)).toEqual([0, 1, 2])
    expect(flat.map((o) => o.id)).toEqual([
      'recipient-combobox-option-0',
      'recipient-combobox-option-1',
      'recipient-combobox-option-2',
    ])
    expect(flat.find((o) => o.isActive)?.index).toBe(2)
  })

  it('omits an empty group', () => {
    const { groups } = buildRecipientGroups([], [RECENT], 0)
    expect(groups.map((g) => g.heading)).toEqual(['Recent'])
  })
})

describe('clampActiveIndex', () => {
  it('clamps into range and returns -1 for an empty list', () => {
    expect(clampActiveIndex(5, 3)).toBe(2)
    expect(clampActiveIndex(-1, 3)).toBe(0)
    expect(clampActiveIndex(1, 3)).toBe(1)
    expect(clampActiveIndex(0, 0)).toBe(-1)
  })
})
