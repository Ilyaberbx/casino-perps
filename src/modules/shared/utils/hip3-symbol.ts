const HIP3_SEPARATOR = ':'

/**
 * Parses a HIP-3 market symbol (`xyz:NVDA`) into its dex tag and display
 * symbol. A symbol is HIP-3 when it carries the `:` separator: the segment
 * before `:` is the dex tag (uppercased), the segment after is the asset to
 * display. Missing segments fall back to the raw symbol. Non-HIP-3 symbols
 * pass through unchanged as the display symbol.
 */
export function parseHip3Symbol(symbol: string): {
  isHip3: boolean
  dexTag: string
  displaySymbol: string
} {
  const isHip3 = symbol.includes(HIP3_SEPARATOR)

  if (!isHip3) {
    return { isHip3: false, dexTag: '', displaySymbol: symbol }
  }

  const segments = symbol.split(HIP3_SEPARATOR)
  const dexSegment = segments[0]
  const assetSegment = segments[1]

  const dexTag = dexSegment ? dexSegment.toUpperCase() : symbol
  const displaySymbol = assetSegment ? assetSegment : symbol

  return { isHip3: true, dexTag, displaySymbol }
}
