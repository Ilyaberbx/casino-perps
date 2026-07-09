import { useCallback, useMemo } from 'react'
import type { DepositFlowAction } from './deposit-flow-provider.types'
import { type AmountValidation, validateAmount } from './deposit-flow.utils'

export interface DepositAmount {
  /** Live validation of the current amount against the wallet balance. */
  readonly validation: AmountValidation
  /** Invalid reason, surfaced only once the field has been touched. */
  readonly amountInvalidReason: string | null
  setAmount(next: string): void
  setAmountToMax(): void
}

/**
 * Owns the amount-input affordances: `setAmount` / `setAmountToMax` (both
 * dispatch `AMOUNT_CHANGED`) and the live `validation` memo. The invalid reason
 * is surfaced only once the user has touched the field (avoids "Enter an
 * amount" on a fresh `ready`).
 */
export function useDepositAmount(
  amount: string,
  walletUsdc: number,
  amountTouched: boolean,
  dispatch: (action: DepositFlowAction) => void,
): DepositAmount {
  const setAmount = useCallback(
    (next: string) => dispatch({ type: 'AMOUNT_CHANGED', amount: next }),
    [dispatch],
  )
  const setAmountToMax = useCallback(
    () => dispatch({ type: 'AMOUNT_CHANGED', amount: walletUsdc.toString() }),
    [walletUsdc, dispatch],
  )

  const validation = useMemo(() => validateAmount(amount, walletUsdc), [amount, walletUsdc])
  const amountInvalidReason = amountTouched ? validation.reason : null

  return { validation, amountInvalidReason, setAmount, setAmountToMax }
}
