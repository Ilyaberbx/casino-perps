import type { OrderField, OrderIssue } from '@/modules/shared/domain'

/** The venue's field-tagged message for a leg, or null when that leg is clean. */
export function issueFor(
  issues: readonly OrderIssue[],
  field: OrderField,
): string | null {
  const match = issues.find((issue) => issue.field === field)
  return match ? match.message : null
}
