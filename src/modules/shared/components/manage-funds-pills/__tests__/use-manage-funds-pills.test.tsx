import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { parseWalletAddress } from '@/modules/shared/domain'
import { useSpectate } from '@/modules/spectate'
import {
  buildPillsVenue,
  wrapWithPillsVenue,
  wrapWithPillsVenueAndSpectate,
} from '../__fixtures__/fake-pills-venue'
import { useManageFunds } from '../../../providers/manage-funds-provider'
import { useManageFundsPills } from '../use-manage-funds-pills'

const SPECTATED_ADDRESS = parseWalletAddress('0x3333333333333333333333333333333333333333')
if (SPECTATED_ADDRESS.isErr()) throw SPECTATED_ADDRESS.error

describe('useManageFundsPills', () => {
  it('lists pills in reference order (Perps⇄Spot, EVM⇄Core, Send, Deposit, Withdraw)', () => {
    const { result } = renderHook(() => useManageFundsPills(), {
      wrapper: wrapWithPillsVenue(buildPillsVenue({ deposit: true })),
    })
    expect(result.current.pills.map((pill) => pill.id)).toEqual([
      'transfer',
      'evm-core',
      'send',
      'deposit',
      'withdraw',
    ])
  })

  it('hasAnyCapability is true when the venue exposes any of deposit/transfer/withdraw', () => {
    const { result } = renderHook(() => useManageFundsPills(), {
      wrapper: wrapWithPillsVenue(buildPillsVenue({ transfer: true })),
    })
    expect(result.current.hasAnyCapability).toBe(true)
  })

  it('hasAnyCapability is false when the venue exposes none of them', () => {
    const { result } = renderHook(() => useManageFundsPills(), {
      wrapper: wrapWithPillsVenue(buildPillsVenue()),
    })
    expect(result.current.hasAnyCapability).toBe(false)
  })

  it('onOpen deep-links a tab via the Manage Funds controller', () => {
    const { result } = renderHook(
      () => ({ pills: useManageFundsPills(), controller: useManageFunds() }),
      { wrapper: wrapWithPillsVenue(buildPillsVenue({ withdraw: true })) },
    )

    act(() => result.current.pills.onOpen('withdraw'))
    expect(result.current.controller.isOpen).toBe(true)
    expect(result.current.controller.activeTab).toBe('withdraw')
  })

  it('onOpen does not open the Manage Funds controller while spectating', () => {
    const { result } = renderHook(
      () => ({
        pills: useManageFundsPills(),
        controller: useManageFunds(),
        spectate: useSpectate(),
      }),
      { wrapper: wrapWithPillsVenueAndSpectate(buildPillsVenue({ withdraw: true })) },
    )

    act(() => result.current.spectate.startSpectating(SPECTATED_ADDRESS.value))
    act(() => result.current.pills.onOpen('withdraw'))

    // Manage Funds always acts on the connected wallet, never the spectated
    // one — opening it mid-spectate would show someone else's balances as the
    // withdraw/send/transfer caps, so the controller must stay closed.
    expect(result.current.controller.isOpen).toBe(false)

    act(() => result.current.spectate.stopSpectating())
    act(() => result.current.pills.onOpen('withdraw'))
    expect(result.current.controller.isOpen).toBe(true)
    expect(result.current.controller.activeTab).toBe('withdraw')
  })
})
