import { useEffect, useState } from 'react'
import { useCapabilityOptional } from '../../providers/venue-provider'
import type { PortfolioSnapshot } from '../../domain'
import type { TradeableFundsGateButtonState } from './tradeable-funds-gate-button.types'

// Tradeable Funds is the live *perp* account-value check (ADR-0027 D-3). Under
// the 'perps' scope the Snapshot's `accountValue` equals the perp equity
// (`marginSummary.accountValue`) — exactly the value the old funded predicate
// read. This keeps the spot-only edge case correct: funds moved entirely to
// spot leave perp `accountValue == 0`, so the gate blocks (First Deposit still
// stands; onboarding does not re-nag).
const TRADEABLE_FUNDS_SCOPE = 'perps' as const

/**
 * Drives `<TradeableFundsGateButton>`. Reads the connected wallet's live perp
 * `accountValue` from the venue's `portfolio` capability Snapshot (~1Hz, ADR-
 * 0027 D-3) and reports whether the submit affordance should render.
 *
 * Scope safety (ADR-0027 D-4): the Snapshot follows the app's address closure
 * (`spectate ?? connected`). This hook deliberately does not read spectate
 * state; the guard lives at the trading-side mount instead — `OrderEntry` only
 * renders the gate in its non-spectating branch (it shows the Stop Spectating
 * button otherwise), so the Snapshot read here is always the connected Primary
 * Wallet's, never a Spectated Address's.
 */
export function useTradeableFundsGateButton(): TradeableFundsGateButtonState {
  const portfolio = useCapabilityOptional('portfolio')
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null)

  useEffect(() => {
    if (!portfolio) return
    return portfolio.subscribeSnapshot(TRADEABLE_FUNDS_SCOPE, setSnapshot)
  }, [portfolio])

  const hasNoPortfolioCapability = portfolio === undefined
  if (hasNoPortfolioCapability) return { kind: 'ready' }

  const isSnapshotPending = snapshot === null
  if (isSnapshotPending) return { kind: 'checking' }

  const hasTradeableFunds = snapshot.accountValue > 0
  if (!hasTradeableFunds) return { kind: 'no-funds' }
  return { kind: 'ready' }
}
