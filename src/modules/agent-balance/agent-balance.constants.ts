// Base mainnet USDC, the single token the Agent Balance tile reads. These are
// chain facts, not env-derived config (ADR per repo conventions: env-derived
// runtime values live in *.config.ts, static chain literals live here).

/** Base mainnet chain id. */
export const BASE_CHAIN_ID = 8453

/** Canonical Circle USDC contract on Base mainnet. */
export const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const

/** USDC is a 6-decimal token. */
export const USDC_DECIMALS = 6

/** Public Base RPC used when `VITE_BASE_RPC_URL` is unset. */
export const PUBLIC_BASE_RPC_URL = 'https://mainnet.base.org'

/** Minimal `balanceOf(address) -> uint256` ABI fragment for the reader. */
export const ERC20_BALANCE_OF_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

/** Placeholder shown for the Agent Balance figure when disconnected / unprovisioned. */
export const EMPTY_BALANCE_DISPLAY = '$0.00'

/**
 * Shown for the Agent Balance figure when the read failed (address fetch or
 * on-chain `balanceOf`) — an explicit "couldn't load" signal so a failed read
 * is never silently rendered as a real `$0.00`.
 */
export const BALANCE_UNAVAILABLE_DISPLAY = 'Unavailable'

/** Smallest USDC amount a deposit / withdraw may move (below this is dust). */
export const MIN_TRANSFER_USDC = 1

/**
 * The single delegation action the scope can name. Mirrors the server literal —
 * there is no free-recipient transfer variant (ADR-0044 D-2).
 */
export const DELEGATION_ACTION = 'usdc-transfer-with-authorization' as const

/**
 * The only live AI Agent in V1 (ADR-0048 D-3). The delegation is per-agent: the
 * grant/status/revoke routes are scoped by this id, and the server hard-validates
 * the recipient against the agent's configured x402 address. The Native Agent is
 * a disabled placeholder and is never delegated to.
 */
export const MINARA_AGENT_ID = 'minara'

/** DEFAULT exact-decimal USDC cap the grant form pre-fills (user-configurable). */
export const DELEGATION_CAP_USD = '50.00'

/** DEFAULT TTL (days) the grant form pre-selects (user-configurable via presets). */
export const DELEGATION_EXPIRY_DAYS = 30

/** The TTL options (days) the Signing tab offers as preset chips; 30 is the default. */
export const DELEGATION_TTL_PRESET_DAYS = [7, 30, 90] as const

/**
 * Client-side UX ceiling on the configurable delegation cap. The server enforces
 * NO maximum (it only checks cap > 0) — this bounds the input so a fat-fingered
 * value is caught before the grant. Not a security boundary; adjust freely.
 */
export const DELEGATION_CAP_MAX_USD = 1000

/** Milliseconds in a day, for deriving the delegation `expiresAt` instant. */
export const MS_PER_DAY = 86_400_000

/** Minimal `transfer(address,uint256) -> bool` ABI fragment for ERC-20 sends. */
export const ERC20_TRANSFER_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const
