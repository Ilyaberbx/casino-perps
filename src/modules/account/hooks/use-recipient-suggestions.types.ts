import type { WalletAddress } from '@/modules/shared/domain'
import type { RecipientSuggestion } from '@/modules/shared/components/recipient-combobox'

export interface UseRecipientSuggestionsOptions {
  /**
   * A wallet to exclude from the "Your wallets" group — the blocked self-send
   * target on Send. Pass `null` on Withdraw, where the user's own wallet is the
   * intended default and should stay in the list.
   */
  readonly selfAddress: WalletAddress | null
}

export interface RecipientSuggestionsView {
  /** The user's own wallets (minus `selfAddress`) as recipient suggestions. */
  readonly walletSuggestions: ReadonlyArray<RecipientSuggestion>
  /** Addresses the user recently sent to, as recipient suggestions. */
  readonly recentSuggestions: ReadonlyArray<RecipientSuggestion>
  /** Persist a completed recipient so it surfaces under "Recent" next time. */
  recordRecipient(address: string): void
}
