const BASE_BRAND_BLUE = '#0052FF'

/**
 * The Base (chainId 8453) brand mark — the official "Base Symbol" glyph: a disc
 * with a horizontal slot cut from its left edge. Rendered as an inline SVG (not
 * an `AssetIcon`) because the chain logo is not in the asset-icon CDN ladder, and
 * the single-path mark is brand-blue regardless of theme. Dumb leaf, no state.
 */
export function BaseChainIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 111 111"
      fill="none"
      role="img"
      aria-label="Base network"
    >
      <path
        d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 22.1714 0 50.3923H72.8467V59.6416H0C2.35281 87.8625 26.0432 110.034 54.921 110.034Z"
        fill={BASE_BRAND_BLUE}
      />
    </svg>
  )
}
