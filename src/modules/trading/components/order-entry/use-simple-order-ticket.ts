import { useCallback, useState } from 'react'
import { useOrderEntry } from './use-order-entry'
import type { UseOrderEntryOptions, UseSimpleOrderTicketReturn } from './order-entry.types'

/**
 * Brain for the Simple ticket. Deliberately thin: `useOrderEntry` already owns
 * validation, preview/estimates, buying-power capacity, and submission, so this
 * only adds the two things Simple has that Pro does not — the price-target
 * toggle (Simple's sole limit affordance: on ⇒ the order becomes a `limit`) and
 * the review sheet that stands between the ticket and `submit()`.
 *
 * Everything Pro-only is suppressed by simply not rendering it: the order-type
 * control, time-in-force, reduce-only, entry TP/SL, and the slippage editor all
 * keep their defaults, which are exactly the values Simple wants.
 */
export function useSimpleOrderTicket(
  options?: UseOrderEntryOptions,
): UseSimpleOrderTicketReturn {
  const entry = useOrderEntry({ initialSizeUnit: 'usd', ...options })
  const [isReviewOpen, setReviewOpen] = useState(false)

  const isPriceTargetOn = entry.form.orderType === 'limit'

  // `setOrderType` already clears the fields the outgoing type owned, so
  // switching back to market drops any stale limit price rather than smuggling
  // it into the order.
  const togglePriceTarget = useCallback(() => {
    entry.setOrderType(isPriceTargetOn ? 'market' : 'limit')
  }, [entry, isPriceTargetOn])

  const openReview = useCallback(() => setReviewOpen(true), [])
  const closeReview = useCallback(() => setReviewOpen(false), [])

  // Dismiss the review as the order goes out: `useOrderEntry.submit` reports the
  // outcome through toasts, and any failure also surfaces as `errorMessage` back
  // on the ticket — so holding the sheet open would just cover both.
  const submit = useCallback(() => {
    entry.submit()
    setReviewOpen(false)
  }, [entry])

  return {
    ...entry,
    submit,
    isPriceTargetOn,
    togglePriceTarget,
    isReviewOpen,
    openReview,
    closeReview,
  }
}
