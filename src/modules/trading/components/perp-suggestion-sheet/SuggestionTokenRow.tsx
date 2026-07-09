import { AssetIcon } from '@/modules/shared/components/asset-icon'
import styles from './perp-suggestion-sheet.module.css'
import type { SuggestionTokenRowProps } from './perp-suggestion-sheet.types'

/**
 * One token row in the searchable Market list (slice 05). Dumb leaf: the shared
 * `AssetIcon` resolves + renders the icon (reusing the Market Selection icon
 * system), the symbol is shown, and a click selects it. Selection state styles
 * the row; the parent owns the actual selection.
 */
export function SuggestionTokenRow({
  token,
  selected,
  onSelect,
}: SuggestionTokenRowProps) {
  return (
    <li>
      <button
        type="button"
        className={styles.tokenRow}
        data-selected={selected}
        aria-pressed={selected}
        onClick={() => onSelect(token.symbol)}
        data-testid={`token-${token.symbol}`}
      >
        <AssetIcon market={token.market} size={20} />
        <span className={styles.tokenSymbol}>{token.symbol}</span>
        <span className={styles.tokenBase}>{token.market.baseAsset}</span>
      </button>
    </li>
  )
}
