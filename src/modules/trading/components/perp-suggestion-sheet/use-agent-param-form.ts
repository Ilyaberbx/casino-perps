import { useCallback, useMemo, useState } from 'react'
import type { SuggestionStyle } from '../../api/suggestions.types'
import {
  AGENT_MAX_LEVERAGE,
  ALLOWED_SYMBOLS,
  DEFAULT_LEVERAGE,
  DEFAULT_MARGIN_USD,
  FALLBACK_MARGIN_MAX_USD,
} from './ai-agents.constants'
import {
  toSuggestionParams,
  validateParams,
} from './perp-suggestion-sheet.utils'
import type {
  AgentParamFormViewModel,
  ParamFormValues,
  UseAgentParamFormOptions,
} from './perp-suggestion-sheet.types'

/**
 * The per-agent param form (slice 08, decoupled in ADR-0056). Seeds Market from
 * the SHEET'S OWN default (last-used symbol; never the terminal selection), caps
 * Margin at live perp collateral and Leverage at `min(market max, 40)`, and
 * validates as the trader edits — field-tagged issues mirroring the order
 * ticket's `OrderIssue`. `style` rides the request; `strategy` is fixed
 * server-side and is not a control here.
 */
export function useAgentParamForm(
  options: UseAgentParamFormOptions,
): AgentParamFormViewModel {
  const {
    defaultSymbol,
    tokens,
    tokensLoading,
    availableCollateralUsd,
    resolveMarketMaxLeverage,
    onSymbolChange,
  } = options

  const [values, setValues] = useState<ParamFormValues>(() => ({
    symbol: defaultSymbol,
    marginUsd: String(DEFAULT_MARGIN_USD),
    leverage: String(DEFAULT_LEVERAGE),
    style: 'scalping',
  }))
  // Tracks which fields the trader has interacted with, so a pristine-but-invalid
  // field (the $0 margin floor) stays silent until touched. `isValid` is NOT gated
  // on this — only the inline issue display is (AgentField).
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const marginMax = useMemo(() => {
    const hasCollateral =
      availableCollateralUsd !== null && availableCollateralUsd > 0
    return hasCollateral ? availableCollateralUsd : FALLBACK_MARGIN_MAX_USD
  }, [availableCollateralUsd])

  const marketMaxLeverage = resolveMarketMaxLeverage(values.symbol)
  const leverageMax = useMemo(
    () => Math.min(marketMaxLeverage ?? AGENT_MAX_LEVERAGE, AGENT_MAX_LEVERAGE),
    [marketMaxLeverage],
  )

  const issues = useMemo(
    () => validateParams(values, marginMax, leverageMax),
    [values, marginMax, leverageMax],
  )

  const setSymbol = useCallback(
    (symbol: string) => {
      setValues((v) => ({ ...v, symbol }))
      setTouched((t) => ({ ...t, symbol: true }))
      onSymbolChange?.(symbol)
    },
    [onSymbolChange],
  )
  const setMarginUsd = useCallback((marginUsd: string) => {
    setValues((v) => ({ ...v, marginUsd }))
    setTouched((t) => ({ ...t, marginUsd: true }))
  }, [])
  const setLeverage = useCallback((leverage: string) => {
    setValues((v) => ({ ...v, leverage }))
    setTouched((t) => ({ ...t, leverage: true }))
  }, [])
  const setStyle = useCallback(
    (style: SuggestionStyle) => setValues((v) => ({ ...v, style })),
    [],
  )

  const toParams = useCallback(() => toSuggestionParams(values), [values])

  return {
    values,
    issues,
    touched,
    allowedSymbols: ALLOWED_SYMBOLS,
    tokens,
    tokensLoading,
    marginMax,
    leverageMax,
    isValid: issues.length === 0,
    setSymbol,
    setMarginUsd,
    setLeverage,
    setStyle,
    toParams,
  }
}
