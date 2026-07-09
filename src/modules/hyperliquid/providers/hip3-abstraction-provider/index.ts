// Provider-unit rule: index.ts exports Provider + consumer hook only.
// Hip3AbstractionContext is private to the unit — never exported from here.
export { Hip3AbstractionProvider } from './Hip3AbstractionProvider'
export { useHyperliquidHip3Abstraction } from './use-hip3-abstraction'
