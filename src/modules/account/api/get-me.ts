import type { ResultAsync } from 'neverthrow'
import type { ApiClient, HttpError } from '@/modules/shared/http'
import type { Me } from '../domain/types'

export function getMe(client: ApiClient): ResultAsync<Me, HttpError> {
  return client.get<Me>('/api/account/me')
}
