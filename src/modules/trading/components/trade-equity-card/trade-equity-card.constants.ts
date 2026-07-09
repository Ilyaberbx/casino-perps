/** The dim em-dash shown for an absent / not-yet-wired scalar (mode-1 of `wallet-gate.md`). */
export const EQUITY_PLACEHOLDER = '—'

export const TOTAL_EQUITY_LABEL = 'Total Equity'
export const SPOT_LABEL = 'Spot'
export const UNREALIZED_PNL_LABEL = 'Unrealized PNL'

/** Perp-bucket label flips with the account margin mode (segregated vs unified). */
export const PERP_BUCKET_LABEL = {
  segregated: 'Perps',
  unified: 'Trading Equity',
} as const

export const MAINTENANCE_MARGIN_LABEL = {
  segregated: 'Maintenance Margin',
  unified: 'Perps Maintenance Margin',
} as const

export const ACCOUNT_LEVERAGE_LABEL = {
  segregated: 'Cross Account Leverage',
  unified: 'Unified Account Leverage',
} as const

/** Reference order: Deposit, Transfer, Withdraw (Transfer hidden in unified). */
export const FUNDING_ACTION_LABELS = {
  deposit: 'Deposit',
  transfer: 'Transfer',
  withdraw: 'Withdraw',
} as const

/**
 * Rows the Simple-mode trade equity card keeps (#278): Spot, Perps / Trading
 * Equity, and Unrealized PNL. Maintenance Margin, Cross Account Leverage, and
 * the Vault / Earn / Staking buckets are hidden in Simple.
 */
export const SIMPLE_EQUITY_ROW_KEYS: ReadonlyArray<string> = [
  'spot',
  'perps',
  'trading',
  'unrealizedPnl',
] as const

/**
 * Margin Ratio (account-health %) badge bands: green below caution, amber up to
 * danger, red at/above danger — so a near-liquidation account never reads as a
 * calm green (the reference only ever showed green). The % text carries the
 * meaning too (never color-only).
 */
export const MARGIN_RATIO_CAUTION_PCT = 50
export const MARGIN_RATIO_DANGER_PCT = 80

// Dotted-underline tooltip copy (the rich Account Leverage breakdown is built
// from live values in buildLeverageBreakdown).
export const TOTAL_EQUITY_TOOLTIP = 'Your total equity across trading, vaults, earn, and staking.'
export const PERPS_TOOLTIP = 'Perps account equity, excluding open-position PnL (shown separately below).'
export const MAINTENANCE_MARGIN_TOOLTIP =
  'The minimum portfolio value required to keep your cross positions open.'

// Shown when funding buttons are tapped while spectating (display follows the
// ghosted account, but deposit/withdraw act on your own — ADR-0072).
export const SPECTATE_FUNDS_TOAST_TITLE = 'Spectate mode'
export const SPECTATE_FUNDS_TOAST_DESCRIPTION =
  'Deposit and withdraw are not available while spectating.'

export const LEVERAGE_BREAKDOWN_LABELS = {
  segregated: {
    a: 'Total Cross Positions Value',
    b: 'Cross Account Value',
    result: 'Cross Account Leverage',
  },
  unified: {
    a: 'Total Positions Value',
    b: 'Account Value',
    result: 'Unified Account Leverage',
  },
} as const
