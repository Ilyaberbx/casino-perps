import type { LogFields, LoggerAdapter } from '../logger.types'

export function MultiLoggerAdapter(
  adapters: ReadonlyArray<LoggerAdapter>,
): LoggerAdapter {
  function fanOut(
    method: 'debug' | 'info' | 'warn' | 'error',
    fields: LogFields,
    message: string,
  ): void {
    for (const adapter of adapters) {
      try {
        adapter[method](fields, message)
      } catch {
        // Swallow per-adapter failures so one broken sink never silences the rest.
      }
    }
  }

  return {
    debug(fields, message) {
      fanOut('debug', fields, message)
    },
    info(fields, message) {
      fanOut('info', fields, message)
    },
    warn(fields, message) {
      fanOut('warn', fields, message)
    },
    error(fields, message) {
      fanOut('error', fields, message)
    },
  }
}
