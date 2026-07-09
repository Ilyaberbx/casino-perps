import type { AgentDescriptor, SelectOption } from './ai-agents.types'

/**
 * The agent leverage cap (`min(market max, 40)` — Minara's schema max, ADR-0048).
 * The form caps leverage at the lower of this and the market's own max.
 */
export const AGENT_MAX_LEVERAGE = 40

/**
 * Default margin (USD) seeded into the slider. $0 is a quiet unset starting state
 * (slider `min:1`, so any interaction lifts it to a valid value); deliberately
 * diverges from Minara's documented $1000.
 */
export const DEFAULT_MARGIN_USD = 0

/** Minimum valid leverage (1x); diverges from Minara's documented 10x. */
export const DEFAULT_LEVERAGE = 1

/** Fallback margin ceiling when live collateral is unknown (no portfolio cap). */
export const FALLBACK_MARGIN_MAX_USD = 1000

/**
 * The client symbol allowlist — mirrors the server `config.suggestionSymbols`
 * seed (ADR-0048). The Market dropdown shows only these; the server is the final
 * authority and rejects unlisted symbols.
 */
export const ALLOWED_SYMBOLS = ['BTC', 'ETH', 'SOL'] as const

/**
 * The sheet-owned static default symbol (ADR-0056). Used when no last-used
 * symbol is persisted. The sheet NEVER defaults from the Trade Page's selected
 * market — that coupling produced the "market is wrong" bug.
 */
export const DEFAULT_SUGGESTION_SYMBOL: string = ALLOWED_SYMBOLS[0]

const STYLE_OPTIONS: readonly SelectOption[] = [
  { value: 'scalping', label: 'Scalping' },
  { value: 'day-trading', label: 'Day trading' },
  { value: 'swing-trading', label: 'Swing trading' },
]

/** Minara — the only live agent in V1; renders its official mark. */
export const MINARA_AGENT: AgentDescriptor = {
  id: 'minara',
  label: 'Minara',
  enabled: true,
  comingSoon: false,
  iconKind: 'minara',
  fields: [
    { kind: 'market', key: 'symbol', label: 'Market' },
    {
      kind: 'slider',
      key: 'marginUsd',
      label: 'Margin',
      min: 1,
      step: 1,
      unit: 'usd',
      maxSource: 'collateral',
    },
    {
      kind: 'slider',
      key: 'leverage',
      label: 'Leverage',
      min: 1,
      step: 1,
      unit: 'x',
      maxSource: 'leverage',
    },
    { kind: 'select', key: 'style', label: 'Trading style', options: STYLE_OPTIONS },
  ],
}

/** Native — a disabled "coming soon" placeholder (three-eye motif, no fields). */
export const NATIVE_AGENT: AgentDescriptor = {
  id: 'native',
  label: 'Native Agent',
  enabled: false,
  comingSoon: true,
  iconKind: 'three-eye',
  fields: [],
}

/** Every agent shown in the picker, in display order. */
export const AI_AGENTS: readonly AgentDescriptor[] = [MINARA_AGENT, NATIVE_AGENT]
