import type { ResultAsync } from 'neverthrow'
import type { ApiClient, HttpError } from '@/modules/shared/http'
import type { Me } from '../domain/types'

/**
 * `DELETE /api/account/wallets/:address` → the updated `UserAccount` with the
 * external wallet removed (PRD-0006 Slice 06). The server re-points the Selected
 * Wallet to the Native wallet in the same transaction if the removed wallet was
 * selected. 404 `NOT_FOUND` (unknown address) and 403 `FORBIDDEN` (cross-user, or
 * a non-removable Native/Agent wallet) surface as `ApiError` for the caller to map.
 */
export function removeWallet(client: ApiClient, address: string): ResultAsync<Me, HttpError> {
  return client.delete<Me>(`/api/account/wallets/${address}`)
}
