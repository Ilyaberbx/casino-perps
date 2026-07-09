// Cache `Intl.NumberFormat` instances by their options. Constructing a formatter
// runs ICU setup (~12µs); `.format()` on a cached one is ~0.3µs. Hot trading
// surfaces (orderbook, trades tape, positions, top-bar) format hundreds of values
// per animation frame, so per-call `Number.prototype.toLocaleString(locale, opts)`
// — which constructs a fresh formatter every call — dominated the per-frame CPU.
//
// `numberFormat(opts).format(v)` is spec-identical to `v.toLocaleString('en-US', opts)`,
// so callers swap with zero output change. The keyspace on the hot paths is a small,
// fixed set of decimal combinations, so the Map never grows unbounded.

const numberFormatters = new Map<string, Intl.NumberFormat>()

export function numberFormat(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = JSON.stringify(options)
  const cached = numberFormatters.get(key)
  if (cached) return cached
  const created = new Intl.NumberFormat('en-US', options)
  numberFormatters.set(key, created)
  return created
}

// Primitive-keyed helpers for the fixed formatter shapes on the orderbook hot path.
// The generic `numberFormat` above allocates a fresh options object AND `JSON.stringify`s
// it on every call — ~69× per rendered book frame. These helpers key the cache on a
// primitive directly (the decimal count, or nothing at all), so a cache hit costs one
// Map/variable read with no per-call allocation or serialization. Each is spec-identical
// to the `numberFormat(...)` call it replaces, so formatted strings are byte-for-byte equal.

const fixedFormatters = new Map<number, Intl.NumberFormat>()

// Fixed-decimal formatter (minimumFractionDigits === maximumFractionDigits === decimals),
// cached by the decimal count. Identical to
// `numberFormat({ minimumFractionDigits: decimals, maximumFractionDigits: decimals })`.
export function fixedFormatter(decimals: number): Intl.NumberFormat {
  const cached = fixedFormatters.get(decimals)
  if (cached) return cached
  const created = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  fixedFormatters.set(decimals, created)
  return created
}

// Compact formatter (`{ notation: 'compact', maximumFractionDigits: 2 }`) — one fixed shape,
// so it needs no key: a lazily-built singleton. Identical to
// `numberFormat({ notation: 'compact', maximumFractionDigits: 2 })`.
let compactFormatterInstance: Intl.NumberFormat | undefined

export function compactFormatter(): Intl.NumberFormat {
  if (compactFormatterInstance) return compactFormatterInstance
  compactFormatterInstance = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  })
  return compactFormatterInstance
}
