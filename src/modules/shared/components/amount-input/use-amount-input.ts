import { useCallback, useId } from 'react'
import type { AmountInputProps } from './amount-input.types'

interface UseAmountInputArgs {
  readonly value: string
  readonly isValid: boolean
  readonly onChange: AmountInputProps['onChange']
}

interface UseAmountInputResult {
  readonly reasonId: string
  readonly showInvalid: boolean
  readonly handleChange: (event: { target: { value: string } }) => void
}

/**
 * Smart hook for `AmountInput`: owns the stable `aria-describedby` id, the
 * "show invalid styling only once the user has typed" derivation, and the
 * change handler. Keeps the component dumb (no `useId`, no handler in the .tsx).
 */
export function useAmountInput({
  value,
  isValid,
  onChange,
}: UseAmountInputArgs): UseAmountInputResult {
  const reasonId = useId()
  const hasValue = value.length > 0
  const showInvalid = hasValue && !isValid

  const handleChange = useCallback(
    (event: { target: { value: string } }) => onChange(event.target.value),
    [onChange],
  )

  return { reasonId, showInvalid, handleChange }
}
