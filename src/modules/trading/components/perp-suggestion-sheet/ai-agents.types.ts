import type { SuggestionStyle } from '../../api/suggestions.types'

/** The selectable AI Agents (UI label for a Suggestion Provider, ADR-0048). */
export type AgentId = 'minara' | 'native'

/** Which bundled icon an agent shows (Minara's mark / the three-eye motif). */
export type AgentIconKind = 'minara' | 'three-eye'

/**
 * The closed field-kind union the param form renders (ADR-0048 — `market |
 * slider | select`, NOT a general form engine). One generic renderer drives the
 * selected agent's schema; the sheet never knows an agent's specific fields.
 */
export type AgentFieldKind = 'market' | 'slider' | 'select'

/** The Market dropdown — prefilled from the current market, allowlist-bounded. */
export interface MarketFieldSchema {
  readonly kind: 'market'
  readonly key: 'symbol'
  readonly label: string
}

/** A bounded slider. `max` is resolved at runtime (live collateral / leverage cap). */
export interface SliderFieldSchema {
  readonly kind: 'slider'
  readonly key: 'marginUsd' | 'leverage'
  readonly label: string
  readonly min: number
  readonly step: number
  readonly unit: 'usd' | 'x'
  /** Where the runtime cap comes from: live perp collateral, or the leverage cap. */
  readonly maxSource: 'collateral' | 'leverage'
}

export interface SelectOption {
  readonly value: SuggestionStyle
  readonly label: string
}

/** The Trading-style dropdown (scalping / day-trading / swing-trading). */
export interface SelectFieldSchema {
  readonly kind: 'select'
  readonly key: 'style'
  readonly label: string
  readonly options: readonly SelectOption[]
}

export type AgentFieldSchema =
  | MarketFieldSchema
  | SliderFieldSchema
  | SelectFieldSchema

/**
 * A client-declared, typed agent descriptor (ADR-0048 — no agents-discovery
 * endpoint; the server re-validates authoritatively). `enabled: false` +
 * `comingSoon: true` is the disabled Native placeholder (no fields, no call).
 */
export interface AgentDescriptor {
  readonly id: AgentId
  readonly label: string
  readonly enabled: boolean
  readonly comingSoon: boolean
  readonly iconKind: AgentIconKind
  readonly fields: readonly AgentFieldSchema[]
}
