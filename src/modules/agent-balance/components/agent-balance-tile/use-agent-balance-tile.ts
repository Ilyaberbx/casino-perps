import { useAgentBalance } from '../../hooks/use-agent-balance'
import type { UseAgentBalanceDeps } from '../../hooks/use-agent-balance'
import type { AgentBalanceTileViewModel } from '../../agent-balance.types'

/**
 * Collaborators for the Agent Balance tile hook. Injected so the hook is
 * unit-testable without viem / Privy / HTTP; production fills both from the
 * env-backed defaults. Re-exported shape of the shared `useAgentBalance` deps.
 */
export type AgentBalanceTileDeps = UseAgentBalanceDeps

/**
 * Smart hook behind the dumb Agent Balance tile. A thin projection over the
 * module's public `useAgentBalance` reading hook — the tile needs the
 * pre-formatted display string plus the read `status` so it can show a loading
 * skeleton instead of the pre-read `$0.00`. The read path (disconnected gate,
 * agent-wallet fetch, Base `USDC.balanceOf` read, venue-independence) lives in
 * `useAgentBalance`; this keeps the tile + the cross-module consumers on one
 * source of truth.
 */
export function useAgentBalanceTile(
  deps: AgentBalanceTileDeps = {},
): AgentBalanceTileViewModel {
  const { display, status } = useAgentBalance(deps)
  return { display, status }
}
