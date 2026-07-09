import type { AgentWalletAddress } from '../agent-balance.types'
import { BASE_USDC_ADDRESS, ERC20_TRANSFER_ABI } from '../agent-balance.constants'

/**
 * The minimal slice of a viem `WalletClient` the Base deposit service depends
 * on: read the connected wallet's chain id, and broadcast a single ERC-20
 * `USDC.transfer(to, amount)`. The service is built against this narrow shape so
 * it is unit-testable with a fake — it never reaches into the rest of the viem
 * wallet-client surface (no chain switch, no typed-data signing).
 */
export interface BaseTransferWalletClient {
  /** The signing account address (undefined when the client has no account). */
  readonly account?: { readonly address: AgentWalletAddress }
  getChainId(): Promise<number>
  writeContract(args: {
    account: { readonly address: AgentWalletAddress }
    chain: { readonly id: typeof import('viem/chains').base.id }
    address: typeof BASE_USDC_ADDRESS
    abi: typeof ERC20_TRANSFER_ABI
    functionName: 'transfer'
    args: readonly [AgentWalletAddress, bigint]
  }): Promise<`0x${string}`>
}

/**
 * The minimal slice of a viem public client the transfer services use to await
 * a broadcast transfer's receipt (so the flow resolves only once mined).
 * `status` distinguishes a real on-chain revert from a successful mine — a
 * reverted receipt must never be reported as a sent transfer.
 */
export interface BaseReceiptClient {
  waitForTransactionReceipt(args: {
    hash: `0x${string}`
  }): Promise<{
    readonly transactionHash: `0x${string}`
    readonly status: 'success' | 'reverted'
  }>
}
