import type { PositionOrderKind } from './position-panel.types'

/** Row label per resting-order kind. TP and SL are named, never collapsed into
 *  a generic "limit" — cancelling the wrong one removes your protection. */
export const ORDER_KIND_LABELS: Readonly<Record<PositionOrderKind, string>> = {
  'take-profit': 'Take profit',
  'stop-loss': 'Stop loss',
  limit: 'Limit',
}

/** CSS-module class per kind (the module's keys are camelCase). */
export const ORDER_KIND_CLASS: Readonly<Record<PositionOrderKind, string>> = {
  'take-profit': 'kindTakeProfit',
  'stop-loss': 'kindStopLoss',
  limit: 'kindLimit',
}

export const EXIT_TARGETS_TITLE = 'Set exit targets'
