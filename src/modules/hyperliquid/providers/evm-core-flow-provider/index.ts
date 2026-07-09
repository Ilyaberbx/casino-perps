// Provider-unit index. Exposes the provider, the body's rich consumer hook
// (`useEvmCoreFlow`), and the port-shaped thin hook (`useHyperliquidEvmCore`) the
// HL venue wires into `VenueEvmCoreCapability`. The context is private.
export { EvmCoreFlowProvider } from './EvmCoreFlowProvider'
export { useEvmCoreFlow } from './use-evm-core-flow'
export { useHyperliquidEvmCore } from './use-hyperliquid-evm-core'
export {
  systemAddressForToken,
  toSystemAddress,
  buildEvmCoreTokenIndex,
  buildEvmCoreTokens,
  buildEvmCoreTokensFromIndex,
  resolveSelectedToken,
  validateEvmCoreAmount,
  percentOfAvailable,
  evmDecimalsForToken,
  toEvmRawAmount,
  mapGatewayErrorToEvmCoreError,
  mapEvmServiceErrorToReason,
} from './evm-core-flow.utils'
export type {
  EvmCoreFlowState,
  EvmCoreToken,
  EvmCoreDirection,
  EvmCorePhase,
  EvmCoreError,
  EvmCorePercent,
  EvmPreflightStatus,
} from './evm-core-flow-provider.types'
