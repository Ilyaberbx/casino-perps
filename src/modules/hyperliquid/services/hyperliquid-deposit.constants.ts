/**
 * Decision-encoding constants for the in-app Hyperliquid deposit (ADR-0028 /
 * `.design/hyperliquid-deposit/`). The deposit is a plain ERC-20
 * `USDC.transfer(BRIDGE2, amount)` on Arbitrum One signed and broadcast by the
 * user's external wallet; HL's Bridge2 credits the sender's address for any
 * USDC transfer at or above the minimum. These values do not go stale.
 */

/** Arbitrum One chain id — the only chain the deposit may broadcast on. */
export const ARBITRUM_CHAIN_ID = 42161 as const

/** Native USDC on Arbitrum One. 6 decimals (NOT 18). */
export const ARBITRUM_USDC_ADDRESS =
  '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as const

/** USDC has 6 decimals; amounts are parsed/formatted at this precision. */
export const USDC_DECIMALS = 6 as const

/**
 * Hyperliquid Bridge2 — the transfer target. A USDC transfer to this address
 * credits the SENDER's HL account automatically (self-custody: never send from
 * an exchange-controlled address).
 */
export const HYPERLIQUID_BRIDGE2_ADDRESS =
  '0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7' as const

/** Minimum deposit Hyperliquid will credit. Below this, funds are lost. */
export const MIN_DEPOSIT_USDC = 5 as const

/**
 * Per-request timeout (ms) for the Arbitrum viem public client (USDC balance
 * reads + receipt-wait polls). viem already defaults to 10s; set explicitly so
 * the bound is visible. The public Arbitrum RPC is rate-limited and can stall —
 * an explicit timeout turns a stall into a surfaced `balance-read-failed` rather
 * than a hung deposit sheet.
 */
export const ARBITRUM_RPC_TIMEOUT_MS = 15_000 as const
