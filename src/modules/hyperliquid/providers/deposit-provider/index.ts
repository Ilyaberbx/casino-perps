// Provider-unit rule: index.ts exports Provider + consumer hook only.
// DepositContext is private to the unit — never exported from here.
export { DepositProvider } from './DepositProvider'
export { useDeposit } from './use-deposit'
