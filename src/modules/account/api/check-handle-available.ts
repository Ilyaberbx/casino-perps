import type { ResultAsync } from 'neverthrow'
import type { ApiClient, HttpError } from '@/modules/shared/http'

/**
 * `GET /api/account/handle-available?handle=<h>` → `{ available }`. A 400
 * (invalid format) surfaces as an `ApiError`, NOT `available: false` — the
 * caller renders it as an inline format error, not "taken" (Slice 03 contract).
 */
export function checkHandleAvailable(
  client: ApiClient,
  handle: string,
): ResultAsync<{ available: boolean }, HttpError> {
  return client.get<{ available: boolean }>(
    `/api/account/handle-available?handle=${encodeURIComponent(handle)}`,
  )
}
