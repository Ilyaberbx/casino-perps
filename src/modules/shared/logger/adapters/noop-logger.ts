import type { Logger } from '../logger.types'

export const NoopLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return NoopLogger
  },
}
