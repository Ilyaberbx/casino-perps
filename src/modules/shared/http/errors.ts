export class SessionExpiredError extends Error {
  readonly kind = 'session-expired' as const
  readonly path: string
  constructor(path: string) {
    super(`Session expired (path: ${path})`)
    this.path = path
  }
}

export class ApiError extends Error {
  readonly kind = 'api' as const
  readonly status: number
  readonly path: string
  readonly body: unknown
  /**
   * The server's `x-request-id` correlation id (echoed by the server's
   * `RequestLoggingMiddleware`). Present whenever the server processed the
   * request and emitted a response; report it to pivot straight to the matching
   * server-side log line (incl. the deeper cause). `undefined` only if the
   * server omitted the header.
   */
  readonly requestId?: string
  constructor(status: number, path: string, body: unknown, requestId?: string) {
    super(`Request to ${path} failed: ${status}`)
    this.status = status
    this.path = path
    this.body = body
    this.requestId = requestId
  }
}

export class NetworkError extends Error {
  readonly kind = 'network' as const
  readonly cause: unknown
  constructor(message: string, cause: unknown) {
    super(message)
    this.cause = cause
  }
}

export class ParseError extends Error {
  readonly kind = 'parse' as const
  readonly cause: unknown
  constructor(message: string, cause: unknown) {
    super(message)
    this.cause = cause
  }
}
