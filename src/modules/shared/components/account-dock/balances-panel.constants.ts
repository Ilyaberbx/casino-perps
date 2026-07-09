export const SMALL_BALANCE_USD_THRESHOLD = 10

/**
 * Loading-skeleton geometry for the Balances table. It is an HTML `<table>` (not
 * a CSS-grid table like the other dock panels), so the skeleton approximates its
 * six columns — Asset, Total, Available, Value, PNL, actions — with an explicit
 * grid template rather than a shared `--*-grid` token.
 */
export const BALANCES_SKELETON_GRID = '1.4fr 1fr 1fr 1fr 1fr 0.6fr'
export const BALANCES_COLUMN_COUNT = 6
