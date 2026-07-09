export interface AgentBalanceActionsViewModel {
  /** Simple mode collapses the three triggers to one "Manage Agent Wallet" button (#273). */
  isSimple: boolean
  openDeposit(): void
  openWithdraw(): void
  openDelegation(): void
}
