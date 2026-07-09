import type { AgentWalletAddress } from '../../agent-balance.types'

/**
 * Props for the dumb deposit body. Deposit is receive-only: the User funds the
 * Agent Wallet by sending USDC on Base to its address (copy / QR). There is no
 * in-app fund-from-connected-wallet transfer — the body renders the receive
 * surface and nothing else.
 */
export interface DepositFlowDeps {
  /** The Agent Wallet receive address (null until the server read resolves). */
  readonly agentWalletAddress: AgentWalletAddress | null
}
