import type { LogFields, LogLevel, Logger } from '../../logger'
import type { VenueOnboardingSeenStorage } from '../venue-onboarding-seen-store'

export interface FakeStorage extends VenueOnboardingSeenStorage {
  readonly data: Map<string, string>
}

export function buildFakeStorage(initial: Record<string, string> = {}): FakeStorage {
  const data = new Map<string, string>(Object.entries(initial))
  return {
    data,
    getItem: (key) => (data.has(key) ? (data.get(key) as string) : null),
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }
}

export interface FakeLogRecord {
  readonly level: LogLevel
  readonly fields: LogFields
  readonly message: string
}

export interface FakeLogger {
  readonly logger: Logger
  readonly records: ReadonlyArray<FakeLogRecord>
}

export function buildFakeLogger(): FakeLogger {
  const records: FakeLogRecord[] = []
  function build(bound: LogFields): Logger {
    function emit(level: LogLevel, fields: LogFields, message: string): void {
      records.push({ level, fields: { ...bound, ...fields }, message })
    }
    return {
      debug: (fields, message) => emit('debug', fields, message),
      info: (fields, message) => emit('info', fields, message),
      warn: (fields, message) => emit('warn', fields, message),
      error: (fields, message) => emit('error', fields, message),
      child: (fields) => build({ ...bound, ...fields }),
    }
  }
  return { logger: build({}), records }
}
