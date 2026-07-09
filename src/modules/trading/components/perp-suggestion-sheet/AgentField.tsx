import type { ChangeEvent } from 'react'
import { PixelSlider } from '@/modules/shared/components/pixel-slider'
import styles from './perp-suggestion-sheet.module.css'
import { paramIssueFor } from './perp-suggestion-sheet.utils'
import { SuggestionTokenList } from './SuggestionTokenList'
import type { AgentFieldProps } from './perp-suggestion-sheet.types'
import type {
  MarketFieldSchema,
  SelectFieldSchema,
  SliderFieldSchema,
} from './ai-agents.types'
import type { AgentParamFormViewModel } from './perp-suggestion-sheet.types'

/**
 * The single generic field renderer for the closed `market | slider | select`
 * field-kind union (slice 08). One component drives every agent's schema — the
 * sheet never knows an agent's specific fields. Dumb: reads/writes through the
 * injected param-form view-model. Shows the field's tagged issue inline.
 */
export function AgentField({ field, form }: AgentFieldProps) {
  switch (field.kind) {
    case 'market':
      return <MarketField field={field} form={form} />
    case 'slider':
      return <SliderField field={field} form={form} />
    case 'select':
      return <SelectField field={field} form={form} />
    default:
      return null
  }
}

function MarketField({
  field,
  form,
}: {
  field: MarketFieldSchema
  form: AgentParamFormViewModel
}) {
  return (
    <SuggestionTokenList
      label={field.label}
      tokens={form.tokens}
      isLoading={form.tokensLoading}
      selectedSymbol={form.values.symbol}
      onSelect={form.setSymbol}
    />
  )
}

function SliderField({
  field,
  form,
}: {
  field: SliderFieldSchema
  form: AgentParamFormViewModel
}) {
  const isMargin = field.key === 'marginUsd'
  const value = isMargin ? form.values.marginUsd : form.values.leverage
  const setter = isMargin ? form.setMarginUsd : form.setLeverage
  const max = field.maxSource === 'collateral' ? form.marginMax : form.leverageMax
  const display = field.unit === 'usd' ? `$${value}` : `${value}x`
  // Show the inline issue only after the trader has touched the field, so a
  // pristine $0 margin stays silent on open (the affordance simply stays gated).
  const isTouched = Boolean(form.touched[field.key])
  const issue = isTouched ? paramIssueFor(form.issues, field.key) : null
  // Leverage heats toward red near its cap (matches the order-ticket leverage
  // slider); margin stays neutral accent throughout.
  const tone = isMargin ? 'accent' : 'danger-ramp'
  const onChange = (next: number): void => setter(String(next))
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabelRow}>
        <span className={styles.fieldLabel}>{field.label}</span>
        <span className={styles.fieldValue}>{display}</span>
      </span>
      <PixelSlider
        value={Number(value)}
        min={field.min}
        max={Math.max(field.min, Math.floor(max))}
        step={field.step}
        tone={tone}
        ariaLabel={field.label}
        testId={`field-${field.key}`}
        onChange={onChange}
      />
      {issue ? (
        <span className={styles.fieldIssue} data-testid={`issue-${field.key}`}>
          {issue}
        </span>
      ) : null}
    </label>
  )
}

function SelectField({
  field,
  form,
}: {
  field: SelectFieldSchema
  form: AgentParamFormViewModel
}) {
  const onChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    const next = field.options.find((o) => o.value === e.target.value)
    if (next) form.setStyle(next.value)
  }
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{field.label}</span>
      <select
        className={styles.select}
        value={form.values.style}
        onChange={onChange}
        data-testid="field-style"
      >
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
