import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  buildManageFundsVenue,
  wrapWithManageFundsVenue,
} from '../__fixtures__/fake-manage-funds-venue'
import { useManageFundsModal } from '../use-manage-funds-modal'

function availabilityById(tabs: ReturnType<typeof useManageFundsModal>['tabs']) {
  return Object.fromEntries(tabs.map((tab) => [tab.id, tab.isAvailable]))
}

describe('useManageFundsModal', () => {
  it('lists all five tabs in canonical order with icons', () => {
    const venue = buildManageFundsVenue({ deposit: true })
    const { result } = renderHook(() => useManageFundsModal(), {
      wrapper: wrapWithManageFundsVenue({ venue }),
    })

    expect(result.current.tabs.map((tab) => tab.id)).toEqual([
      'deposit',
      'transfer',
      'send',
      'withdraw',
      'evm-core',
    ])
    expect(result.current.tabs.every((tab) => tab.Icon != null)).toBe(true)
  })

  it('marks deposit/transfer/withdraw/send available only when the capability exists', () => {
    const venue = buildManageFundsVenue({ deposit: true, withdraw: true, send: true })
    const { result } = renderHook(() => useManageFundsModal(), {
      wrapper: wrapWithManageFundsVenue({ venue }),
    })

    expect(availabilityById(result.current.tabs)).toEqual({
      deposit: true,
      transfer: false,
      withdraw: true,
      send: true,
      'evm-core': false,
    })
  })

  it('marks evm-core available iff the evm-core capability exists', () => {
    const withCap = renderHook(() => useManageFundsModal(), {
      wrapper: wrapWithManageFundsVenue({ venue: buildManageFundsVenue({ evmCore: true }) }),
    })
    expect(availabilityById(withCap.result.current.tabs)['evm-core']).toBe(true)

    const withoutCap = renderHook(() => useManageFundsModal(), {
      wrapper: wrapWithManageFundsVenue({ venue: buildManageFundsVenue({ send: true }) }),
    })
    expect(availabilityById(withoutCap.result.current.tabs)['evm-core']).toBe(false)
  })

  it('exposes the resolved send capability view when present', () => {
    const venue = buildManageFundsVenue({ send: true })
    const { result } = renderHook(() => useManageFundsModal(), {
      wrapper: wrapWithManageFundsVenue({ venue }),
    })

    expect(result.current.send).not.toBeNull()
  })

  it('exposes the resolved evm-core capability view when present', () => {
    const venue = buildManageFundsVenue({ evmCore: true })
    const { result } = renderHook(() => useManageFundsModal(), {
      wrapper: wrapWithManageFundsVenue({ venue }),
    })

    expect(result.current.evmCore).not.toBeNull()
  })

  it('exposes resolved capability views and null for absent ones', () => {
    const venue = buildManageFundsVenue({ transfer: true })
    const { result } = renderHook(() => useManageFundsModal(), {
      wrapper: wrapWithManageFundsVenue({ venue }),
    })

    expect(result.current.deposit).toBeNull()
    expect(result.current.withdraw).toBeNull()
    expect(result.current.transfer).not.toBeNull()
    expect(typeof result.current.transfer?.useTransfer).toBe('function')
  })

  it('reflects the open/active-tab controller state', () => {
    const venue = buildManageFundsVenue({ withdraw: true })
    const { result } = renderHook(() => useManageFundsModal(), {
      wrapper: wrapWithManageFundsVenue({ venue, defaultOpen: true, defaultTab: 'withdraw' }),
    })

    expect(result.current.isOpen).toBe(true)
    expect(result.current.activeTab).toBe('withdraw')
  })
})
