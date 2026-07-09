import { SuggestionTokenRow } from './SuggestionTokenRow'
import styles from './perp-suggestion-sheet.module.css'
import type { SuggestionListRowViewProps } from './perp-suggestion-sheet.types'

/**
 * One flat row of the virtualized Market dropdown (OPT-2, ADR-0019): an
 * asset-class section header or a token button. Dumb leaf — the windowing parent
 * (`SuggestionTokenList`) feeds it a single discriminated `SuggestionListRow`;
 * selection state belongs to the parent. Keeps the `token-group-<category>`
 * header testid and delegates token rows to `SuggestionTokenRow`.
 */
export function SuggestionListRowView({
  row,
  selectedSymbol,
  onSelect,
}: SuggestionListRowViewProps) {
  if (row.kind === 'header') {
    return (
      <p
        className={styles.groupHeader}
        data-testid={`token-group-${row.category}`}
      >
        {row.label}
      </p>
    )
  }
  return (
    <SuggestionTokenRow
      token={row.token}
      selected={row.token.symbol === selectedSymbol}
      onSelect={onSelect}
    />
  )
}
