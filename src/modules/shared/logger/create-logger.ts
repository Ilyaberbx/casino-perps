import type {
  CreateLoggerOptions,
  LogFields,
  LogLevel,
  Logger,
  LoggerAdapter,
} from './logger.types'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

function buildLogger(
  adapter: LoggerAdapter,
  threshold: number,
  bound: LogFields,
): Logger {
  function emit(level: LogLevel, fields: LogFields, message: string): void {
    if (LEVEL_PRIORITY[level] < threshold) return
    const merged: LogFields = { ...bound, ...fields }
    adapter[level](merged, message)
  }

  return {
    debug(fields, message) {
      emit('debug', fields, message)
    },
    info(fields, message) {
      emit('info', fields, message)
    },
    warn(fields, message) {
      emit('warn', fields, message)
    },
    error(fields, message) {
      emit('error', fields, message)
    },
    child(fields) {
      return buildLogger(adapter, threshold, { ...bound, ...fields })
    },
  }
}

export function createLogger(options: CreateLoggerOptions): Logger {
  return buildLogger(options.adapter, LEVEL_PRIORITY[options.level], {})
}
