import { ResultAsync } from 'neverthrow'
import { formatUnits } from 'viem'
import {
  BASE_USDC_ADDRESS,
  ERC20_BALANCE_OF_ABI,
  USDC_DECIMALS,
} from '../agent-balance.constants'
import type {
  AgentWalletAddress,
  BalanceReadFailed,
  BaseUsdcBalanceReader,
  UsdcBalanceClient,
} from '../agent-balance.types'

export interface CreateBaseUsdcBalanceReaderOptions {
  /** Base public client — only its `readContract` slice is used (testable). */
  readonly client: UsdcBalanceClient
}

/**
 * Reads `USDC.balanceOf(agentWallet)` on Base (chainId 8453, 6-decimal USDC)
 * and converts the raw `uint256` into a plain dollar number. The viem call is
 * wrapped at the boundary into a typed `BalanceReadFailed` — no `try/catch`
 * escapes this file, and an RPC reject becomes `err`, never a throw.
 */
export function createBaseUsdcBalanceReader(
  options: CreateBaseUsdcBalanceReaderOptions,
): BaseUsdcBalanceReader {
  const client = options.client

  const readUsdcBalance = (
    address: AgentWalletAddress,
  ): ResultAsync<number, BalanceReadFailed> =>
    ResultAsync.fromPromise(
      client.readContract({
        address: BASE_USDC_ADDRESS,
        abi: ERC20_BALANCE_OF_ABI,
        functionName: 'balanceOf',
        args: [address],
      }),
      (cause): BalanceReadFailed => ({ kind: 'balance-read-failed', cause }),
    ).map((raw) => Number(formatUnits(raw, USDC_DECIMALS)))

  return { readUsdcBalance }
}
