import type { PortfolioAccountScope } from '../../../shared/domain'
import { SCOPE_OPTIONS } from './portfolio-summary-card.constants'

/**
 * The scope-toggle options visible for the current account structure. A unified
 * / portfolio-margin account (`isSegregated: false`) has no meaningful perps-only
 * view, so the `'perps'` option is dropped — only the combined `'all'` view
 * remains (ADR-0033 D-4). A segregated (classic) account keeps every option.
 */
export function visibleScopeOptions(
  isSegregated: boolean,
): ReadonlyArray<{ label: string; value: PortfolioAccountScope }> {
  if (isSegregated) return SCOPE_OPTIONS
  return SCOPE_OPTIONS.filter((option) => option.value !== 'perps')
}
