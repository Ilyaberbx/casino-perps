import type { ResultAsync } from 'neverthrow'
import type {
  SessionExpiredError,
  ApiError,
  NetworkError,
  ParseError,
} from './errors'

export type HttpError = SessionExpiredError | ApiError | NetworkError | ParseError

export type SessionExpiredHandler = () => void

export type CreateApiClientArgs = {
  getAccessToken: () => Promise<string | null>
  baseUrl?: string
}

export type ApiClient = {
  get: <T>(path: string) => ResultAsync<T, HttpError>
  post: <T>(path: string, body: unknown) => ResultAsync<T, HttpError>
  /** Issues an HTTP DELETE (no body). See ADR-0059. */
  delete: <T>(path: string) => ResultAsync<T, HttpError>
  subscribeToSessionExpired: (handler: SessionExpiredHandler) => () => void
}
