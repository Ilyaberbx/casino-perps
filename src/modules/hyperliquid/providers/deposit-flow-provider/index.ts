// Provider-unit index. Exposes the provider, the body's rich consumer hook
// (`useDepositFlow`), and the port-shaped thin hook (`useHyperliquidDeposit`)
// the HL venue wires into `VenueDepositCapability`. The context is private.
export { DepositFlowProvider } from './DepositFlowProvider'
export { useDepositFlow } from './use-deposit-flow'
export { useHyperliquidDeposit } from './use-hyperliquid-deposit'
export { validateAmount, hasFundingForDeposit } from './deposit-flow.utils'
export type {
  DepositFlowState,
  DepositFlowErrorReason,
  DepositPhase,
} from './deposit-flow-provider.types'
