import { okAsync } from 'neverthrow'
import type { WalletAddress } from '@/modules/shared/domain'
import type { AgentWalletState } from '../../agent-wallet-provider/agent-wallet-provider.context'
import type { BuilderFeeState } from '../../builder-fee-provider/builder-fee-provider.context'
import type { DepositState } from '../../deposit-provider/deposit-provider.context'

export function buildFakeAgentState(
  partial: Partial<AgentWalletState> = {},
): AgentWalletState {
  return {
    status: 'missing',
    agentAddress: null,
    existingAgents: null,
    approve: () => okAsync(undefined),
    ...partial,
  } as AgentWalletState
}

export function buildFakeBuilderState(
  partial: Partial<BuilderFeeState> = {},
): BuilderFeeState {
  return {
    status: 'missing',
    approvedBuilders: null,
    approve: () => okAsync(undefined),
    replaceBuilder: () => okAsync(undefined),
    ...partial,
  } as BuilderFeeState
}

export function buildFakeDepositState(
  partial: Partial<DepositState> = {},
): DepositState {
  return {
    status: 'needs-deposit',
    recheck: () => undefined,
    ...partial,
  }
}

export const FAKE_PRIMARY_ADDRESS = '0xdeadbeef00000000000000000000000000000001' as WalletAddress
