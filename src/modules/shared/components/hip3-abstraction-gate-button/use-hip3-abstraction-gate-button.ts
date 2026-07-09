import { useCallback } from 'react'
import { useVenueHip3Abstraction } from '../../providers/venue-hip3-abstraction-provider'
import type { Hip3AbstractionErrorReason } from '../../domain'
import type { Hip3AbstractionGateButtonState } from './hip3-abstraction-gate-button.types'

// Short, submit-adjacent copy for a failed enable attempt. The full onboarding
// CTA machine is intentionally not reused here — this is a one-line hint above a
// single retry affordance, not a step card.
function copyForReason(reason: Hip3AbstractionErrorReason): string {
  switch (reason) {
    case 'wallet-rejected':
      return 'Signature cancelled. Enable HIP-3 trading to continue.'
    case 'chain-mismatch':
      return 'Switch your wallet network, then enable HIP-3 trading.'
    case 'signing-unavailable':
      return 'Wallet unavailable. Reconnect, then try again.'
    case 'deposit-required':
      return 'Deposit funds first, then enable HIP-3 trading.'
    case 'rate-limited':
      return 'Rate limited. Wait a moment, then try again.'
    case 'unknown':
      return 'Could not enable HIP-3 trading. Try again.'
    default: {
      const exhaustive: never = reason
      return exhaustive
    }
  }
}

/**
 * Drives `<Hip3AbstractionGateButton>`. Reads the active venue's HIP-3
 * abstraction state and reports whether the submit affordance should render, or
 * be replaced with an "Enable HIP-3 trading" gate (ADR-0081). A non-HIP-3 market
 * — or a venue with no HIP-3 capability — always passes through.
 */
export function useHip3AbstractionGateButton(isHip3: boolean): Hip3AbstractionGateButtonState {
  const hip3 = useVenueHip3Abstraction()
  const onEnable = useCallback(() => {
    void hip3?.enable()
  }, [hip3])

  if (!isHip3) return { kind: 'ready' }
  if (hip3 === null) return { kind: 'ready' }

  const status = hip3.status
  if (status === 'enabled') return { kind: 'ready' }
  if (status === 'checking') return { kind: 'checking' }
  if (status === 'enabling') return { kind: 'enabling' }
  if (status === 'disabled') return { kind: 'enable', onEnable, errorCopy: null }
  return { kind: 'enable', onEnable, errorCopy: copyForReason(status.reason) }
}
