import type { ResultAsync } from 'neverthrow'
import type { ApiClient, HttpError } from '@/modules/shared/http'
import type { Me } from '../domain/types'

/**
 * Provenance the client may attach to an imported wallet (ADR-0076 D-6). The
 * link-external flow sends `external` (link-only, the default); the raw-key
 * import flow sends `imported` (a Privy embedded wallet from a private key).
 * `embedded` is never imported — the Native wallet is created at onboarding.
 */
export type ImportWalletSource = 'external' | 'imported'

/**
 * `POST /api/account/wallets/import` body `{ address, source }` → the updated
 * `UserAccount` with the new wallet (PRD-0006 Slice 06 / ADR-0076 D-6).
 * Ownership is proven server-side via Privy; the client supplies the address it
 * just linked/imported and the provenance. `source` defaults to `external` (the
 * server's own default), so the existing link flow needs no change. 403
 * `FORBIDDEN` (ownership), 409 `WALLET_CAP_REACHED`, and 409
 * `WALLET_ALREADY_IN_USE` all surface as `ApiError` for the caller to map.
 */
export function importWallet(
  client: ApiClient,
  address: string,
  source: ImportWalletSource = 'external',
): ResultAsync<Me, HttpError> {
  return client.post<Me>('/api/account/wallets/import', { address, source })
}
