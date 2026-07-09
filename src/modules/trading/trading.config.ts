// Env-derived runtime config for the trading module (NOT a constant — see
// frontend-architecture.md: env-derived values live in *.config.ts). The x402
// suggestion fee is the per-call cost the engine pays each provider; it is
// surfaced on the left suggestion-sheet CTA so the User sees the cost before
// buying a suggestion. `VITE_MINARA_SUGGESTION_COST_USD` is an OPTIONAL
// override; an unset / malformed value falls back to the documented default.
// Mirrors `resolveBaseRpcUrl`'s precedence-with-fallback.

const DEFAULT_SUGGESTION_COST_USD = 0.05

export interface SuggestionCostEnv {
  readonly VITE_MINARA_SUGGESTION_COST_USD?: string
}

/**
 * Resolve the per-suggestion x402 cost (USD). A missing / non-positive /
 * non-numeric override resolves the default — a misconfigured env never shows a
 * nonsensical price on the CTA.
 */
export function resolveSuggestionCostUsd(env: SuggestionCostEnv): number {
  const raw = env.VITE_MINARA_SUGGESTION_COST_USD
  const isMissing = raw === undefined || raw === ''
  if (isMissing) return DEFAULT_SUGGESTION_COST_USD
  const parsed = Number(raw)
  const isUsable = Number.isFinite(parsed) && parsed > 0
  if (!isUsable) return DEFAULT_SUGGESTION_COST_USD
  return parsed
}

/** Format the resolved cost for the CTA, e.g. `$0.05`. */
export function formatSuggestionCost(costUsd: number): string {
  return `$${costUsd.toFixed(2)}`
}

// VITE_LANDING_URL is the deployed landing/marketing site's base URL — the
// canonical home of the legal pages (ADR-0075). The order disclaimer's "Terms
// of Use" link deep-links to `/terms` there. Falls back to the landing dev
// server (port 5173) when unset, so a bare `pnpm dev` still wires up.
const FALLBACK_LANDING_URL = 'http://localhost:5173'
const TERMS_PATH = '/terms'

const baseLandingUrl = (import.meta.env.VITE_LANDING_URL || FALLBACK_LANDING_URL).replace(/\/+$/, '')

export const tradingConfig = {
  termsUrl: `${baseLandingUrl}${TERMS_PATH}`,
}
