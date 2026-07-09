import type { ResultAsync } from 'neverthrow'
import type { ApiClient, HttpError } from '@/modules/shared/http'

/** Client-facing feature flags returned by `GET /api/config`. */
export type AppConfigResponse = { inviteGateEnabled: boolean }

/**
 * `GET /api/config` → `{ inviteGateEnabled }`. The endpoint is public on the
 * server, but the shared transport still attaches the Privy JWT when present;
 * callers fetch it post-auth (where a token exists). On any error the consumer
 * defaults to gate-enabled (fail-safe), so this wrapper just surfaces the
 * `HttpError` rather than swallowing it.
 */
export function getAppConfig(
  client: ApiClient,
): ResultAsync<AppConfigResponse, HttpError> {
  return client.get<AppConfigResponse>('/api/config')
}
