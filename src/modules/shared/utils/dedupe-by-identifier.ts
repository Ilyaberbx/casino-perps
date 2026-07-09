/**
 * Order-preserving dedupe on the shared `identifier` field — keeps the first
 * occurrence of each id and drops the rest.
 *
 * The venue layer projects several domain rows that can carry a *repeated* id:
 * Hyperliquid's public `trades` WS publishes both sides of a match as two
 * events sharing one `tid`, and `userFills` can do the same on a self-trade.
 * Any list that uses such an id as its React `key` would otherwise render two
 * siblings with the same key. Routing every id-keyed projection through this
 * helper makes key uniqueness a data-layer invariant rather than a per-consumer
 * concern.
 */
export function dedupeByIdentifier<T extends { identifier: string }>(
  items: ReadonlyArray<T>,
): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    const isDuplicate = seen.has(item.identifier)
    if (isDuplicate) continue
    seen.add(item.identifier)
    out.push(item)
  }
  return out
}
