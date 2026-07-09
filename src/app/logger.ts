import { ConsoleLoggerAdapter, createLogger, type Logger } from '@/modules/shared/logger'
import { resolveLogLevel } from '@/modules/shared/logger/resolve-log-level'

const { level, invalidRaw } = resolveLogLevel(
  import.meta.env.VITE_LOG_LEVEL,
  import.meta.env.DEV,
)

export const logger: Logger = createLogger({
  level,
  adapter: ConsoleLoggerAdapter,
})

if (invalidRaw !== null) {
  logger.warn(
    { module: 'app-logger', invalidValue: invalidRaw, fallback: level },
    'invalid log level override',
  )
}
