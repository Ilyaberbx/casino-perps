import type { LogFields, LoggerAdapter } from '../logger.types'

export const ConsoleLoggerAdapter: LoggerAdapter = {
  debug(fields: LogFields, message: string): void {
    console.debug(message, fields)
  },
  info(fields: LogFields, message: string): void {
    console.info(message, fields)
  },
  warn(fields: LogFields, message: string): void {
    console.warn(message, fields)
  },
  error(fields: LogFields, message: string): void {
    console.error(message, fields)
  },
}
