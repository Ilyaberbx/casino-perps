import type { ChangeEvent } from 'react'
import styles from './suggestion-preview.module.css'
import { issueFor } from './suggestion-preview.utils'
import type { EditableLegsProps } from './suggestion-preview.types'

/**
 * The editable legs of a suggestion before placing (slice 10): margin, leverage,
 * entry, stop loss, take profit. Every keystroke re-runs `Trader.validateDraft`
 * upstream against LIVE account state, so the venue-authored, field-tagged issues
 * here reflect "do I still have the margin", not the figures at request time. A
 * read-only (expired) suggestion disables every input. Dumb.
 */
export function EditableLegs(props: EditableLegsProps) {
  const { edit, readOnly, issues } = props
  const sizeIssue = issueFor(issues, 'size')
  const priceIssue = issueFor(issues, 'price')
  const untagged = issues.filter((issue) => issue.field === undefined)

  return (
    <div className={styles.legs} data-testid="editable-legs">
      <LegInput
        label="Margin (USD)"
        testId="leg-margin"
        value={edit.marginUsd}
        readOnly={readOnly}
        onChange={props.setMarginUsd}
        issue={sizeIssue}
      />
      <LegInput
        label="Leverage"
        testId="leg-leverage"
        value={edit.leverage}
        readOnly={readOnly}
        onChange={props.setLeverage}
      />
      <LegInput
        label="Entry"
        testId="leg-entry"
        value={edit.entry}
        readOnly={readOnly}
        onChange={props.setEntry}
        issue={priceIssue}
      />
      <LegInput
        label="Stop loss"
        testId="leg-stop-loss"
        value={edit.stopLoss}
        readOnly={readOnly}
        onChange={props.setStopLoss}
      />
      <LegInput
        label="Take profit"
        testId="leg-take-profit"
        value={edit.takeProfit}
        readOnly={readOnly}
        onChange={props.setTakeProfit}
      />

      {untagged.length > 0 ? (
        <ul className={styles.issueList} data-testid="leg-issues">
          {untagged.map((issue) => (
            <li key={issue.message} className={styles.issue}>
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function LegInput({
  label,
  testId,
  value,
  readOnly,
  onChange,
  issue,
}: {
  label: string
  testId: string
  value: string
  readOnly: boolean
  onChange(value: string): void
  issue?: string | null
}) {
  const handle = (e: ChangeEvent<HTMLInputElement>): void => onChange(e.target.value)
  return (
    <label className={styles.leg}>
      <span className={styles.legLabel}>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        className={styles.legInput}
        value={value}
        onChange={handle}
        disabled={readOnly}
        data-testid={testId}
        data-invalid={issue ? 'true' : undefined}
      />
      {issue ? (
        <span className={styles.legIssue} data-testid={`${testId}-issue`}>
          {issue}
        </span>
      ) : null}
    </label>
  )
}
