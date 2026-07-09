import type { ResultAsync } from 'neverthrow'
import type { ApiClient, HttpError } from '@/modules/shared/http'
import type { Me, OnboardingInput } from '../domain/types'

export function onboard(
  client: ApiClient,
  input: OnboardingInput,
): ResultAsync<Me, HttpError> {
  return client.post<Me>('/api/account/onboard', input)
}
