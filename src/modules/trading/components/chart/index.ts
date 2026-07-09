// Chart is intentionally NOT re-exported here: a static barrel export would keep
// it (and lightweight-charts) in the synchronous chunk and defeat LazyChart's
// dynamic import (Rollup INEFFECTIVE_DYNAMIC_IMPORT). Consumers use LazyChart;
// tests import ./Chart directly.
export { LazyChart } from './LazyChart'
