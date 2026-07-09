import { useAuth, useSelectedWallet } from '@/modules/account'
import { useDepositSheet } from '@/modules/shared/providers/deposit-sheet-provider'
import { useDepositFlow } from '../../providers/deposit-flow-provider'
import type { DepositFlowState } from '../../providers/deposit-flow-provider'

export interface DepositFlowBodyView {
  readonly flow: DepositFlowState
  /** The Selected Wallet's Arbitrum receive address (QR + copy), or null if absent. */
  readonly receiveAddress: string | null
  close(): void
}

/**
 * Smart hook for the deposit body. Composes the rich machine state
 * (`useDepositFlow`), the Selected Wallet's receive address, and the host's
 * `close()` for the terminal "Done" affordance. The body component stays dumb.
 *
 * `receiveAddress` mirrors the exact expression the deposit provider broadcasts
 * from and reads balance against (`masterAddress ?? primaryWalletAddress`): the
 * Selected Wallet when connectable, else the Privy-canonical primary. Using the
 * same rule keeps the QR/copy address aligned with where funds actually land —
 * `masterAddress` alone is deliberately `null` for a non-connectable selection
 * (ADR-0061), so the fallback belongs here, at the call site.
 */
export function useDepositFlowBody(): DepositFlowBodyView {
  const flow = useDepositFlow()
  const { primaryWalletAddress } = useAuth()
  const { masterAddress } = useSelectedWallet()
  const { close } = useDepositSheet()
  return { flow, receiveAddress: masterAddress ?? primaryWalletAddress, close }
}
