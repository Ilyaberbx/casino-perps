import { defineChain } from 'viem'
import type { Chain } from 'viem'
import type { WalletAddress } from '@/modules/shared/domain'
import type { HyperliquidNetwork } from '../hyperliquid.types'

/**
 * Decision-encoding constants for the HyperEVM chain integration (ADR-0069 — the
 * EVM→Core direction of the EVM⇄Core flow). HyperEVM has no viem built-in chain,
 * so we define it here. These values are stable per network.
 */

/** HyperEVM chain id — mainnet 999 / testnet 998 (keyed by `VITE_HYPERLIQUID_NETWORK`). */
export const HYPEREVM_CHAIN_ID: Readonly<Record<HyperliquidNetwork, number>> = {
  mainnet: 999,
  testnet: 998,
}

/** Native gas token on HyperEVM is HYPE, 18 decimals on the EVM side. */
export const HYPE_EVM_DECIMALS = 18 as const

/**
 * Public default RPC per network. Optional override via `VITE_HYPEREVM_RPC_URL`
 * (see `resolveHyperEvmRpcUrl`). HyperEVM exposes no native WS RPC.
 */
export const HYPEREVM_DEFAULT_RPC_URL: Readonly<Record<HyperliquidNetwork, string>> = {
  mainnet: 'https://rpc.hyperliquid.xyz/evm',
  testnet: 'https://rpc.hyperliquid-testnet.xyz/evm',
}

/**
 * HyperEVM block explorer (purrsec). Used for the EVM→Core `sent`-state tx link.
 * Confirm against the live docs before mainnet use (ADR-0069).
 */
export const HYPEREVM_EXPLORER_BASE_URL: Readonly<Record<HyperliquidNetwork, string>> = {
  mainnet: 'https://purrsec.com',
  testnet: 'https://testnet.purrsec.com',
}

/**
 * Per-request timeout (ms) for the HyperEVM viem public client (balance reads +
 * receipt-wait polls). The public RPC can stall; an explicit timeout turns a
 * stall into a surfaced read error rather than a hung pane (mirrors Arbitrum).
 */
export const HYPEREVM_RPC_TIMEOUT_MS = 15_000 as const

/**
 * The RAW HL name of the native gas token. HYPE is special in both directions:
 * its system address is the literal `0x2222…2222` (not the index-derived one),
 * and on HyperEVM it is the native coin, not an ERC20.
 */
export const HYPE_TOKEN_NAME = 'HYPE'

/**
 * HYPE's system address — sending HYPE here on HyperCore credits the user's
 * HyperEVM HYPE balance, and the EVM→Core native send targets it. ⚠ Sending any
 * NON-HYPE asset to this address burns it; every other token MUST use its own
 * index-derived system address.
 */
export const HYPE_SYSTEM_ADDRESS =
  '0x2222222222222222222222222222222222222222' as WalletAddress

/**
 * The base of the standard token system-address range: `0x20` followed by 19
 * zero bytes. `systemAddress(index) = SYSTEM_ADDRESS_BASE + index` (big-endian in
 * the low bytes). Example: index 200 → `0x20000000000000000000000000000000000000c8`.
 */
export const SYSTEM_ADDRESS_BASE = 0x2000000000000000000000000000000000000000n

/**
 * Build the viem `Chain` for HyperEVM on the given network, bound to `rpcUrl`
 * (the resolved override or the public default). viem has no built-in HyperEVM
 * chain; this is the single definition used by the EVM→Core public/wallet clients
 * and the runtime `addChain` fallback.
 */
export function defineHyperEvmChain(network: HyperliquidNetwork, rpcUrl: string): Chain {
  return defineChain({
    id: HYPEREVM_CHAIN_ID[network],
    name: network === 'mainnet' ? 'HyperEVM' : 'HyperEVM Testnet',
    nativeCurrency: { name: 'Hype', symbol: 'HYPE', decimals: HYPE_EVM_DECIMALS },
    rpcUrls: { default: { http: [rpcUrl] } },
    blockExplorers: {
      default: { name: 'Purrsec', url: HYPEREVM_EXPLORER_BASE_URL[network] },
    },
    testnet: network === 'testnet',
  })
}

/** The EVM→Core explorer transaction URL for a mined HyperEVM tx hash. */
export function hyperEvmExplorerTxUrl(network: HyperliquidNetwork, hash: string): string {
  return `${HYPEREVM_EXPLORER_BASE_URL[network]}/tx/${hash}`
}
