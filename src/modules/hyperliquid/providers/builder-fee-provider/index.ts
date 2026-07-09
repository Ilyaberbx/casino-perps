// Provider-unit rule: index.ts exports Provider + consumer hook only.
// BuilderFeeContext is private to the unit — never exported from here.
export { BuilderFeeProvider } from './BuilderFeeProvider'
export { useBuilderFee } from './use-builder-fee'
