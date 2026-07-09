import type { ReactNode } from 'react'

export interface Hip3AbstractionGateButtonProps {
  /**
   * `true` when the market the ticket targets is a HIP-3 (builder-deployed)
   * market. The gate only ever activates for HIP-3 markets — a main-dex order is
   * always passed straight through.
   */
  readonly isHip3: boolean
  readonly children: ReactNode
}

/**
 * HIP-3 abstraction gate state:
 * - `ready` — pass the submit affordance through (not a HIP-3 market, the venue
 *   has no HIP-3 capability, or abstraction is already enabled).
 * - `checking` — abstraction-mode read still in flight for a HIP-3 market → hold
 *   behind a disabled "Checking…" button.
 * - `enabling` — the enable signature is in flight → disabled "Enabling HIP-3…".
 * - `enable` — a default account on a HIP-3 market → show the "Enable HIP-3
 *   trading" affordance (`onEnable`), optionally with an `errorCopy` hint from a
 *   previous failed attempt.
 */
export type Hip3AbstractionGateButtonState =
  | { readonly kind: 'ready' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'enabling' }
  | { readonly kind: 'enable'; readonly onEnable: () => void; readonly errorCopy: string | null }
