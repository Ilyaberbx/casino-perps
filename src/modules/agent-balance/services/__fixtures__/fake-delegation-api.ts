import { errAsync, okAsync, type ResultAsync } from 'neverthrow'
import type { ApiClient, HttpError } from '@/modules/shared/http'

export interface ApiSpy {
  posts: { url: string; body: unknown }[]
  gets: string[]
}

export interface FakeApiClientOptions {
  /** The `status` the GET / confirm / revoke routes resolve to. */
  readonly status?: string
  /** The `appSignerId` returned by prepare + the GET status read. */
  readonly appSignerId?: string
  /** The `policyId` returned by prepare. */
  readonly policyId?: string
  /** When set, every POST fails with this `HttpError`. */
  readonly postFailsWith?: HttpError
  /** When set, every GET fails with this `HttpError`. */
  readonly getFailsWith?: HttpError
}

const PREPARE_URL = '/api/agent-treasury/delegation'

/**
 * A fake `ApiClient` for the delegation seam (ADR-0078): records each get/post and
 * returns the right shape per route — prepare (`POST /delegation`) →
 * `{ appSignerId, policyId }`; confirm / revoke → `{ status }`; the status GET →
 * `{ status, appSignerId }`. No transport, no network.
 */
export function buildFakeApiClient(
  options: FakeApiClientOptions = {},
  spy: ApiSpy = { posts: [], gets: [] },
): ApiClient {
  const status = options.status ?? 'active'
  const appSignerId = options.appSignerId ?? 'app-signer-1'
  const policyId = options.policyId ?? 'policy-1'
  return {
    get: (<T>(url: string): ResultAsync<T, HttpError> => {
      spy.gets.push(url)
      if (options.getFailsWith) return errAsync(options.getFailsWith)
      return okAsync({ status, appSignerId } as T)
    }) as ApiClient['get'],
    post: (<T>(url: string, body: unknown): ResultAsync<T, HttpError> => {
      spy.posts.push({ url, body })
      if (options.postFailsWith) return errAsync(options.postFailsWith)
      // The prepare route returns the scoped policy; confirm / revoke return status.
      const isPrepare = url === PREPARE_URL
      return okAsync((isPrepare ? { appSignerId, policyId } : { status }) as T)
    }) as ApiClient['post'],
    delete: (<T>(url: string): ResultAsync<T, HttpError> => {
      spy.gets.push(url)
      return okAsync({ status } as T)
    }) as ApiClient['delete'],
    subscribeToSessionExpired: () => () => {},
  }
}
