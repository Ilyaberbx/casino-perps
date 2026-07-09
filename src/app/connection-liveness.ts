import { createConnectionLiveness } from '@/modules/shared/services/connection-liveness'
import { logger } from './logger'

/**
 * App-scope connection-liveness coordinator (ADR-0041). Module-scoped singleton
 * — same pattern as the wallet-address / agent-signing holders — so it survives
 * venue rebuilds (address change, reconnect-generation bump). Stream readers
 * subscribe their `withReconnect` to `resyncSignal` and the gateway stamps
 * `notifyActivity`; both are threaded in via `buildHyperliquidEntry`. `start()`
 * is mounted once by `AppShell`.
 */
export const connectionLiveness = createConnectionLiveness({
  logger: logger.child({ module: 'connection-liveness' }),
})
