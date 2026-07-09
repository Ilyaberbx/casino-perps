import { AssetIcon } from '@/modules/shared/components/asset-icon'
import { buildIconMarketFromSymbol } from '@/modules/shared/utils/resolve-market-icon-url'
import styles from './suggestion-preview.module.css'
import { NO_LEVEL_PLACEHOLDER } from './suggestion-preview.constants'
import type { RawSuggestionViewProps } from './suggestion-preview.types'

/**
 * The agent's raw response shown unchanged (slice 10): side, confidence, entry /
 * SL / TP, reasons, risks — not a reinterpretation. The confidence bar fills once
 * on reveal and the reason/risk legs stagger in (compositor-only beats, slice 12,
 * degraded under reduced-motion). Dumb.
 */
export function RawSuggestionView({ raw, agentId, symbol }: RawSuggestionViewProps) {
  return (
    <div className={styles.raw} data-testid="raw-suggestion">
      <div className={styles.rawHead}>
        <AssetIcon market={buildIconMarketFromSymbol(symbol)} size={18} />
        <span className={styles.symbol}>{symbol}</span>
        <span className={styles.agentBadge}>{agentId}</span>
        <span className={styles.side} data-side={raw.side}>
          {raw.side.toUpperCase()}
        </span>
        <span className={styles.confidenceValue}>{raw.confidence}%</span>
      </div>

      <div
        className={styles.confidenceTrack}
        role="meter"
        aria-valuenow={raw.confidence}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Confidence"
      >
        <div
          className={styles.confidenceFill}
          style={{ width: `${Math.max(0, Math.min(100, raw.confidence))}%` }}
        />
      </div>

      <dl className={styles.levels}>
        <Level label="Entry" value={raw.entryPrice} />
        <Level label="Stop loss" value={raw.stopLossPrice} />
        <Level label="Take profit" value={raw.takeProfitPrice} />
      </dl>

      {raw.reasons.length > 0 ? (
        <NoteList title="Reasons" notes={raw.reasons} tone="up" />
      ) : null}
      {raw.risks.length > 0 ? (
        <NoteList title="Risks" notes={raw.risks} tone="down" />
      ) : null}
    </div>
  )
}

function Level({ label, value }: { label: string; value: number | null }) {
  return (
    <div className={styles.levelRow}>
      <dt>{label}</dt>
      <dd className={styles.mono}>{value ?? NO_LEVEL_PLACEHOLDER}</dd>
    </div>
  )
}

function NoteList({
  title,
  notes,
  tone,
}: {
  title: string
  notes: readonly string[]
  tone: 'up' | 'down'
}) {
  return (
    <div className={styles.notes}>
      <h4 className={styles.notesTitle}>{title}</h4>
      <ul className={styles.notesList}>
        {notes.map((note, index) => (
          <li
            key={note}
            className={styles.note}
            data-tone={tone}
            style={{ animationDelay: `${index * 40}ms` }}
          >
            {note}
          </li>
        ))}
      </ul>
    </div>
  )
}
