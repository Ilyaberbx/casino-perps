import { err, errAsync } from 'neverthrow'
import { HyperliquidGatewayError } from '../hyperliquid-gateway.types'
import type { HyperliquidExchangeGateway } from '../nktkas-hyperliquid-exchange-gateway'

type FakeExchangeGatewayOverrides = Partial<HyperliquidExchangeGateway>

// Default stubs return errAsync so tests that forget to override a method fail loudly.
const notStubbed = (method: string) =>
  errAsync(new HyperliquidGatewayError('network', `${method} not stubbed`))

// Sync (Result-returning) default stub for the format helpers.
const notStubbedSync = (method: string) =>
  err(new HyperliquidGatewayError('invalid-response', `${method} not stubbed`))

export function buildFakeExchangeGateway(
  partial: FakeExchangeGatewayOverrides = {},
): HyperliquidExchangeGateway {
  return {
    approveAgent: partial.approveAgent ?? (() =>
      notStubbed('approveAgent') as ReturnType<HyperliquidExchangeGateway['approveAgent']>
    ),
    signL1Action: partial.signL1Action ?? (() =>
      notStubbed('signL1Action') as ReturnType<HyperliquidExchangeGateway['signL1Action']>
    ),
    approveBuilderFee: partial.approveBuilderFee ?? (() =>
      notStubbed('approveBuilderFee') as ReturnType<HyperliquidExchangeGateway['approveBuilderFee']>
    ),
    usdClassTransfer: partial.usdClassTransfer ?? (() =>
      notStubbed('usdClassTransfer') as ReturnType<HyperliquidExchangeGateway['usdClassTransfer']>
    ),
    withdraw3: partial.withdraw3 ?? (() =>
      notStubbed('withdraw3') as ReturnType<HyperliquidExchangeGateway['withdraw3']>
    ),
    usdSend: partial.usdSend ?? (() =>
      notStubbed('usdSend') as ReturnType<HyperliquidExchangeGateway['usdSend']>
    ),
    spotSend: partial.spotSend ?? (() =>
      notStubbed('spotSend') as ReturnType<HyperliquidExchangeGateway['spotSend']>
    ),
    queryMaxBuilderFee: partial.queryMaxBuilderFee ?? (() =>
      notStubbed('queryMaxBuilderFee') as ReturnType<HyperliquidExchangeGateway['queryMaxBuilderFee']>
    ),
    queryAgents: partial.queryAgents ?? (() =>
      notStubbed('queryAgents') as ReturnType<HyperliquidExchangeGateway['queryAgents']>
    ),
    queryApprovedBuilders: partial.queryApprovedBuilders ?? (() =>
      notStubbed('queryApprovedBuilders') as ReturnType<HyperliquidExchangeGateway['queryApprovedBuilders']>
    ),
    revokeBuilderFee: partial.revokeBuilderFee ?? (() =>
      notStubbed('revokeBuilderFee') as ReturnType<HyperliquidExchangeGateway['revokeBuilderFee']>
    ),
    queryHasEverFunded: partial.queryHasEverFunded ?? (() =>
      notStubbed('queryHasEverFunded') as ReturnType<HyperliquidExchangeGateway['queryHasEverFunded']>
    ),
    enableDexAbstraction: partial.enableDexAbstraction ?? (() =>
      notStubbed('enableDexAbstraction') as ReturnType<HyperliquidExchangeGateway['enableDexAbstraction']>
    ),
    queryUserAbstraction: partial.queryUserAbstraction ?? (() =>
      notStubbed('queryUserAbstraction') as ReturnType<HyperliquidExchangeGateway['queryUserAbstraction']>
    ),
    placeOrder: partial.placeOrder ?? (() =>
      notStubbed('placeOrder') as ReturnType<HyperliquidExchangeGateway['placeOrder']>
    ),
    cancelOrder: partial.cancelOrder ?? (() =>
      notStubbed('cancelOrder') as ReturnType<HyperliquidExchangeGateway['cancelOrder']>
    ),
    cancelOrderByCloid: partial.cancelOrderByCloid ?? (() =>
      notStubbed('cancelOrderByCloid') as ReturnType<HyperliquidExchangeGateway['cancelOrderByCloid']>
    ),
    modifyOrder: partial.modifyOrder ?? (() =>
      notStubbed('modifyOrder') as ReturnType<HyperliquidExchangeGateway['modifyOrder']>
    ),
    placeTwapOrder: partial.placeTwapOrder ?? (() =>
      notStubbed('placeTwapOrder') as ReturnType<HyperliquidExchangeGateway['placeTwapOrder']>
    ),
    cancelTwap: partial.cancelTwap ?? (() =>
      notStubbed('cancelTwap') as ReturnType<HyperliquidExchangeGateway['cancelTwap']>
    ),
    updateLeverage: partial.updateLeverage ?? (() =>
      notStubbed('updateLeverage') as ReturnType<HyperliquidExchangeGateway['updateLeverage']>
    ),
    formatPrice: partial.formatPrice ?? (() =>
      notStubbedSync('formatPrice') as ReturnType<HyperliquidExchangeGateway['formatPrice']>
    ),
    formatSize: partial.formatSize ?? (() =>
      notStubbedSync('formatSize') as ReturnType<HyperliquidExchangeGateway['formatSize']>
    ),
  }
}
