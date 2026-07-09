import { useCallback, useMemo, useState } from 'react'
import { logger } from '@/app/logger'
import { createRecentRecipientsStore } from '@/modules/shared/services/recent-recipients-store'
import {
  buildRecentRecipientSuggestions,
  buildWalletRecipientSuggestions,
} from '@/modules/shared/components/recipient-combobox'
import { useOnboardingFlow } from './use-onboarding-flow'
import type {
  RecipientSuggestionsView,
  UseRecipientSuggestionsOptions,
} from './use-recipient-suggestions.types'

/** Stable empty recents (no user resolved / read failed) so the memo identity holds. */
const NO_RECENTS: ReadonlyArray<string> = []

/**
 * Recipient suggestions for a send / withdraw destination field: the user's own
 * wallets (from the onboarding cache) plus addresses they recently sent to
 * (localStorage, keyed by Privy DID, shared across every flow). Lives in `account`
 * because it is the only module allowed to read the wallet list; each venue /
 * agent flow consumes this hook and feeds the results into the shared
 * `RecipientCombobox`. The recent list is a pure localStorage read done in render
 * (mirrors the favorites provider's lazy load); a version counter forces a re-read
 * after `recordRecipient` persists a new address — so no setState-in-effect.
 */
export function useRecipientSuggestions(
  options: UseRecipientSuggestionsOptions,
): RecipientSuggestionsView {
  const { selfAddress } = options
  const flow = useOnboardingFlow()
  const me = flow.kind === 'ready' ? flow.me : null
  const privyId = me?.user.privyId ?? null

  const store = useMemo(() => createRecentRecipientsStore({ logger }), [])
  const [recentsVersion, setRecentsVersion] = useState(0)
  const recentAddresses = useMemo(() => {
    if (privyId === null) return NO_RECENTS
    const loaded = store.load(privyId)
    return loaded.isOk() ? loaded.value : NO_RECENTS
  }, [privyId, store, recentsVersion])

  const walletSuggestions = useMemo(
    () => buildWalletRecipientSuggestions(me?.wallets ?? [], selfAddress),
    [me, selfAddress],
  )
  const recentSuggestions = useMemo(
    () => buildRecentRecipientSuggestions(recentAddresses, me?.wallets ?? [], selfAddress),
    [recentAddresses, me, selfAddress],
  )

  const recordRecipient = useCallback(
    (address: string) => {
      if (privyId === null) return
      store.record(privyId, address)
      setRecentsVersion((version) => version + 1)
    },
    [privyId, store],
  )

  return { walletSuggestions, recentSuggestions, recordRecipient }
}
