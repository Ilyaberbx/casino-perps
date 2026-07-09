import type { ResultAsync } from 'neverthrow'
import type { ApiClient, HttpError } from '@/modules/shared/http'
import type { Me } from '../domain/types'

/**
 * Sets the actor's **Selected Wallet** (PRD-0006 Slice 05). The server runs the
 * two-row transaction (unset current `isSelected`, set target) and returns the
 * updated `Me`. Idempotent: re-selecting the already-selected wallet is a no-op
 * success. A cross-user address yields a 403 `ApiError`.
 */
export function selectWallet(client: ApiClient, address: string): ResultAsync<Me, HttpError> {
  return client.post<Me>(`/api/account/wallets/${address}/select`, {})
}
