import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { DelegationConsentViewModel } from '../../../agent-balance.types'

const useDelegationConsentMock = vi.fn<() => DelegationConsentViewModel>()

vi.mock('../use-delegation-consent', () => ({
  useDelegationConsent: () => useDelegationConsentMock(),
}))

vi.mock('@/modules/account', () => ({
  ConnectWalletGateButton: (props: { children: React.ReactNode }) => props.children,
}))

import { DelegationConsent } from '../DelegationConsent'

function baseVm(overrides: Partial<DelegationConsentViewModel> = {}): DelegationConsentViewModel {
  return {
    phase: 'idle',
    status: 'not-granted',
    isActive: false,
    scope: { recipient: '0x5555…5555', cap: '$50.00', expiry: '2026-07-12' },
    capUsd: '50.00',
    capInvalidReason: null,
    ttlDays: 30,
    ttlPresets: [7, 30, 90],
    canGrant: true,
    errorReason: null,
    setCapUsd: vi.fn(),
    setTtlDays: vi.fn(),
    grant: vi.fn(),
    revoke: vi.fn(),
    ...overrides,
  }
}

function deps() {
  return {
    recipient: '0x5555555555555555555555555555555555555555' as const,
    getStatus: vi.fn() as never,
    getGrantPort: vi.fn() as never,
  }
}

describe('DelegationConsent', () => {
  beforeEach(() => useDelegationConsentMock.mockReset())

  it('renders the recipient, a cap input, ttl chips and the expiry preview when editing', () => {
    useDelegationConsentMock.mockReturnValue(baseVm())
    render(<DelegationConsent {...deps()} />)

    expect(screen.getByText('0x5555…5555')).toBeInTheDocument()
    expect(screen.getByLabelText(/spending cap in usdc/i)).toHaveValue('50.00')
    // The TTL presets render as chips.
    expect(screen.getByRole('button', { name: '7d' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '30d' })).toHaveAttribute('aria-pressed', 'true')
    // The expiry preview reflects the derived scope.
    expect(screen.getByText(/2026-07-12/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/not-granted/i)
  })

  it('renders the granted scope (recipient, cap, expiry) read-only when active', () => {
    useDelegationConsentMock.mockReturnValue(
      baseVm({
        status: 'active',
        isActive: true,
        scope: { recipient: '0x5555…5555', cap: '$80.00', expiry: '2026-09-01' },
      }),
    )
    render(<DelegationConsent {...deps()} />)

    expect(screen.getByText('$80.00')).toBeInTheDocument()
    expect(screen.getByText('2026-09-01')).toBeInTheDocument()
    // No cap input in the active state.
    expect(screen.queryByLabelText(/spending cap in usdc/i)).not.toBeInTheDocument()
  })

  it('offers a grant control when not active', () => {
    useDelegationConsentMock.mockReturnValue(baseVm({ isActive: false }))
    render(<DelegationConsent {...deps()} />)
    expect(screen.getByRole('button', { name: /grant delegation/i })).toBeInTheDocument()
  })

  it('offers a revoke control when active', () => {
    useDelegationConsentMock.mockReturnValue(
      baseVm({ status: 'active', isActive: true }),
    )
    render(<DelegationConsent {...deps()} />)
    expect(screen.getByRole('button', { name: /revoke delegation/i })).toBeInTheDocument()
  })

  it('disables the grant control while consent is in flight', () => {
    useDelegationConsentMock.mockReturnValue(baseVm({ phase: 'granting' }))
    render(<DelegationConsent {...deps()} />)
    expect(screen.getByRole('button', { name: /awaiting consent/i })).toBeDisabled()
  })

  it('disables the grant control when the cap is invalid', () => {
    useDelegationConsentMock.mockReturnValue(
      baseVm({ canGrant: false, capInvalidReason: 'Minimum is 1 USDC' }),
    )
    render(<DelegationConsent {...deps()} />)
    expect(screen.getByRole('button', { name: /grant delegation/i })).toBeDisabled()
  })

  it('surfaces an error alert when the hook reports a failure', () => {
    useDelegationConsentMock.mockReturnValue(baseVm({ phase: 'error', errorReason: 'server' }))
    render(<DelegationConsent {...deps()} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/try again/i)
  })
})
