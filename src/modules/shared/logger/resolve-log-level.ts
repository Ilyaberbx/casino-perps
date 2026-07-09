import { z } from 'zod'
import type { LogLevel } from './logger.types'

const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error'])

/**
 * Resolves the configured client log level from the optional `VITE_LOG_LEVEL`
 * override, falling back to the dev/prod default. The override wins whenever it
 * is set and valid (so it can raise the dev floor from `debug` to `warn`); an
 * invalid value is ignored and surfaced via `invalidRaw` so the caller can warn
 * once the logger exists. See `apps/client/.claude/rules/logging.md`.
 */
export function resolveLogLevel(
  rawLevel: string | undefined,
  isDev: boolean,
): { level: LogLevel; invalidRaw: string | null } {
  const defaultLevel: LogLevel = isDev ? 'debug' : 'info'

  const isUnset = rawLevel === undefined || rawLevel === ''
  if (isUnset) return { level: defaultLevel, invalidRaw: null }

  const parsed = logLevelSchema.safeParse(rawLevel)
  if (parsed.success) return { level: parsed.data, invalidRaw: null }

  return { level: defaultLevel, invalidRaw: rawLevel }
}
