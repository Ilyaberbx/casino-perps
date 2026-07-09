export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogFields = Record<string, unknown>

export interface Logger {
  info(fields: LogFields, message: string): void
  warn(fields: LogFields, message: string): void
  error(fields: LogFields, message: string): void
  debug(fields: LogFields, message: string): void
  child(fields: LogFields): Logger
}

export interface LoggerAdapter {
  info(fields: LogFields, message: string): void
  warn(fields: LogFields, message: string): void
  error(fields: LogFields, message: string): void
  debug(fields: LogFields, message: string): void
}

export interface CreateLoggerOptions {
  level: LogLevel
  adapter: LoggerAdapter
}
