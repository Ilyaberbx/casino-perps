import { describe, it, expect, vi } from 'vitest'
import { arbitrum } from 'viem/chains'
import type { ConnectedWallet } from '@privy-io/react-auth'
import {
  buildMasterWalletClient,
  coerceToAuthError,
  findConnectedMasterWallet,
  resolveSelectedMaster,
} from '../auth-provider.utils'

function fakeWallet(address: string, walletClientType: string): ConnectedWallet {
  return { address, walletClientType } as unknown as ConnectedWallet
}

function fakeConnectedWallet(address: string, walletClientType = 'metamask'): ConnectedWallet {
  return {
    address,
    walletClientType,
    getEthereumProvider: vi.fn().mockResolvedValue({ request: vi.fn() }),
  } as unknown as ConnectedWallet
}

const MASTER = '0xAbC0000000000000000000000000000000000001'

describe('findConnectedMasterWallet', () => {
  it('returns the wallet whose address matches the master (case-insensitive)', () => {
    const external = fakeWallet(MASTER.toLowerCase(), 'metamask')
    const wallets = [fakeWallet('0xother', 'privy'), external]
    expect(findConnectedMasterWallet(wallets, MASTER)).toBe(external)
  })

  it('matches the embedded Privy wallet by address (ADR-0060 — no type filter)', () => {
    const embedded = fakeWallet(MASTER.toLowerCase(), 'privy')
    const wallets = [embedded]
    expect(findConnectedMasterWallet(wallets, MASTER)).toBe(embedded)
  })

  it('returns null when no wallet matches the master address (still hydrating)', () => {
    const wallets = [fakeWallet('0xsomeoneelse', 'metamask')]
    expect(findConnectedMasterWallet(wallets, MASTER)).toBeNull()
  })

  it('returns null when the master address is null', () => {
    expect(findConnectedMasterWallet([fakeWallet(MASTER, 'metamask')], null)).toBeNull()
  })
})

describe('buildMasterWalletClient', () => {
  it('returns null when no wallet matches the master address', async () => {
    const wallets = [fakeWallet('0xsomeoneelse', 'metamask')]
    expect(await buildMasterWalletClient(wallets, MASTER)).toBeNull()
  })

  it('builds a chain-less WalletClient for the signing accessor (no chain bound)', async () => {
    const wallets = [fakeConnectedWallet(MASTER.toLowerCase())]
    const client = await buildMasterWalletClient(wallets, MASTER)
    expect(client).not.toBeNull()
    expect(client?.chain).toBeUndefined()
    expect(client?.account?.address).toBe(MASTER.toLowerCase())
  })

  it('builds a WalletClient from the embedded Privy wallet (ADR-0060)', async () => {
    const wallets = [fakeConnectedWallet(MASTER.toLowerCase(), 'privy')]
    const client = await buildMasterWalletClient(wallets, MASTER)
    expect(client).not.toBeNull()
    expect(client?.account?.address).toBe(MASTER.toLowerCase())
  })

  it('binds the passed chain for the broadcast accessor (Arbitrum One)', async () => {
    const wallets = [fakeConnectedWallet(MASTER.toLowerCase())]
    const client = await buildMasterWalletClient(wallets, MASTER, arbitrum)
    expect(client?.chain?.id).toBe(arbitrum.id)
  })
})

describe('resolveSelectedMaster (Selected-Wallet → master reconciliation, Slice E)', () => {
  const SELECTED = '0xSeL0000000000000000000000000000000000001'
  const FALLBACK = '0xFaLL000000000000000000000000000000000002'

  it('uses the Selected Wallet as the master when it is a live connectable external wallet', () => {
    const result = resolveSelectedMaster({
      selectedAddress: SELECTED,
      fallbackAddress: FALLBACK,
      connectableAddresses: [SELECTED.toLowerCase()],
    })
    expect(result.masterAddress).toBe(SELECTED)
    expect(result.isSelectionConnectable).toBe(true)
  })

  it('surfaces a non-connectable stored selection: master null (never silently Native), flag false', () => {
    const result = resolveSelectedMaster({
      selectedAddress: SELECTED,
      fallbackAddress: FALLBACK,
      connectableAddresses: [FALLBACK.toLowerCase()],
    })
    // ADR-0061 / Fix 3: a picked-but-not-connected imported wallet resolves to
    // `null`, NOT the Native/canonical fallback — signing consumers treat that as
    // signing-unavailable (connect-to-grant), never a silent Native signature.
    expect(result.masterAddress).toBeNull()
    expect(result.isSelectionConnectable).toBe(false)
  })

  it('no stored selection → fallback master, nothing to reconcile (flag true)', () => {
    const result = resolveSelectedMaster({
      selectedAddress: null,
      fallbackAddress: FALLBACK,
      connectableAddresses: [],
    })
    expect(result.masterAddress).toBe(FALLBACK)
    expect(result.isSelectionConnectable).toBe(true)
  })
})

describe('coerceToAuthError', () => {
  it('maps "User rejected" message to {kind:"cancelled"}', () => {
    expect(coerceToAuthError(new Error('User rejected the request'))).toEqual({
      kind: 'cancelled',
    })
  })

  it('maps PrivyErrorCode "user_does_not_exist" to {kind:"no-credential"}', () => {
    const err = Object.assign(new Error('user does not exist'), {
      privyErrorCode: 'user_does_not_exist',
    })
    expect(coerceToAuthError(err)).toEqual({ kind: 'no-credential' })
  })

  it('maps PrivyErrorCode "invalid_credentials" to {kind:"no-credential"}', () => {
    const err = Object.assign(new Error('bad creds'), {
      privyErrorCode: 'invalid_credentials',
    })
    expect(coerceToAuthError(err)).toEqual({ kind: 'no-credential' })
  })

  it('maps PrivyErrorCode "exited_auth_flow" to {kind:"cancelled"}', () => {
    const err = Object.assign(new Error('exited'), {
      privyErrorCode: 'exited_auth_flow',
    })
    expect(coerceToAuthError(err)).toEqual({ kind: 'cancelled' })
  })

  it('maps PrivyErrorCode "disallowed_login_method" to {kind:"not-configured"}', () => {
    const err = Object.assign(new Error('disallowed'), {
      privyErrorCode: 'disallowed_login_method',
    })
    expect(coerceToAuthError(err)).toEqual({ kind: 'not-configured' })
  })

  it('maps unrecognised errors to {kind:"unknown", cause}', () => {
    const cause = new Error('something exploded')
    expect(coerceToAuthError(cause)).toEqual({ kind: 'unknown', cause })
  })

  it('maps a string cause to {kind:"unknown", cause}', () => {
    expect(coerceToAuthError('boom')).toEqual({ kind: 'unknown', cause: 'boom' })
  })
})
