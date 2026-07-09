import { AiMascot } from '@/modules/shared/components/ai-marker'
import { ValueSkeleton } from '@/modules/shared/components/value-skeleton'
import { AssetIcon } from '@/modules/shared/components/asset-icon'
import { buildIconMarket } from '@/modules/shared/utils/resolve-market-icon-url'
import { BALANCE_UNAVAILABLE_DISPLAY } from '../../agent-balance.constants'
import styles from './agent-balance-tile.module.css'
import { useAgentBalanceTile } from './use-agent-balance-tile'
import { BaseChainIcon } from './BaseChainIcon'
import { AgentBalanceActions } from '../agent-balance-actions'

/**
 * The Agent Balance metric tile: the User's Agent Wallet USDC balance on Base,
 * rendered as one friendly USD figure plus the Deposit / Withdraw entry points
 * (`<AgentBalanceActions>`, wallet-gated). Marked as a quiet AI/agent surface
 * (faint accent tint + the static mascot glyph) so it reads distinct from the
 * Volume / Fees tiles. Deliberately structurally separate from Account Value
 * and the DEX balances panel — it is venue-independent and never a `Balance` row.
 * Dumb body: all state lives in `useAgentBalanceTile`.
 */
export function AgentBalanceTile() {
  const { display, status } = useAgentBalanceTile()
  const isLoading = status === 'loading'
  const isError = status === 'error'

  return (
    <div className={styles.tile} aria-label="Agent Balance">
      <div className={styles.aiRow}>
        <AiMascot size={20} />
        <span className={styles.tileLabel}>Agent Balance</span>
      </div>
      {isLoading ? (
        <ValueSkeleton ariaLabel="Loading agent balance" width={90} height={18} />
      ) : (
        <span className={isError ? styles.tileError : styles.tileBody} role={isError ? 'status' : undefined}>
          {isError ? BALANCE_UNAVAILABLE_DISPLAY : display}
        </span>
      )}
      <span className={styles.tileHint}>
        <BaseChainIcon size={14} />
        <AssetIcon market={buildIconMarket('USDC', 'perp')} size={14} />
        Base USDC
      </span>
      <AgentBalanceActions />
    </div>
  )
}
