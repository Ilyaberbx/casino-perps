import { PixelButton } from '@/modules/shared/components/pixel-button'
import { AssetIcon } from '@/modules/shared/components/asset-icon'
import { buildIconMarketFromSymbol } from '@/modules/shared/utils/resolve-market-icon-url'
import { AgentIcon } from './AgentIcon'
import { EXPIRED_BADGE, REOPEN_LABEL } from './perp-suggestion-sheet.constants'
import { resolveAgentIconKind } from './perp-suggestion-sheet.utils'
import styles from './perp-suggestion-sheet.module.css'
import type { HistoryRowProps } from './perp-suggestion-sheet.types'

/**
 * One history row (slice 11): agent-badged, side + confidence, with an expired
 * marker when past validity. Opening a row re-opens it in the same preview;
 * expired rows open read-only (Place disabled in the preview). Dumb.
 */
export function HistoryRow({ row, expired, onReopen }: HistoryRowProps) {
  const { rawSuggestion } = row
  return (
    <li className={styles.historyRow} data-testid="history-row" data-expired={expired}>
      <div className={styles.historyMeta}>
        <AssetIcon market={buildIconMarketFromSymbol(row.requestParams.symbol)} size={18} />
        <span className={styles.symbol}>{row.requestParams.symbol}</span>
        <AgentIcon kind={resolveAgentIconKind(row.agentId)} size={16} />
        <span className={styles.side} data-side={rawSuggestion.side}>
          {rawSuggestion.side}
        </span>
        <span className={styles.mono}>{rawSuggestion.confidence}%</span>
        {expired ? (
          <span className={styles.expiredBadge} data-testid="expired-badge">
            {EXPIRED_BADGE}
          </span>
        ) : null}
      </div>
      <PixelButton size="sm" variant="default" onClick={() => onReopen(row)}>
        {REOPEN_LABEL}
      </PixelButton>
    </li>
  )
}
