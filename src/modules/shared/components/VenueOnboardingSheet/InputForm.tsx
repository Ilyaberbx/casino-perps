import { type ChangeEvent } from 'react'
import styles from './venue-onboarding-sheet.module.css'
import type { FieldRendererProps, InputFormProps } from './venue-onboarding-sheet.types'

function FieldRenderer({ spec, values, onValueChange }: FieldRendererProps) {
  if (spec.kind === 'text') {
    return (
      <label className={styles.fieldLabel}>
        {spec.label}
        <input
          className={styles.fieldInput}
          type="text"
          value={values[spec.id] ?? ''}
          placeholder={spec.placeholder}
          minLength={spec.minLength}
          maxLength={spec.maxLength}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onValueChange(spec.id, e.target.value)
          }
        />
      </label>
    )
  }

  if (spec.kind === 'select') {
    return (
      <label className={styles.fieldLabel}>
        {spec.label}
        <select
          className={styles.fieldSelect}
          value={values[spec.id] ?? ''}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            onValueChange(spec.id, e.target.value)
          }
        >
          {spec.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    )
  }

  const isChecked = values[spec.id] === 'true'
  return (
    <label className={`${styles.fieldLabel} ${styles.fieldCheckbox}`}>
      <input
        type="checkbox"
        checked={isChecked}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onValueChange(spec.id, e.target.checked ? 'true' : 'false')
        }
      />
      {spec.label}
    </label>
  )
}

export function InputForm({ inputs, values, onValueChange }: InputFormProps) {
  if (inputs.length === 0) return null

  return (
    <div className={styles.form} data-testid="input-form">
      {inputs.map((spec) => (
        <FieldRenderer
          key={spec.id}
          spec={spec}
          values={values}
          onValueChange={onValueChange}
        />
      ))}
    </div>
  )
}
