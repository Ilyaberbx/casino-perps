import type { RecipientWalletSource } from './recipient-combobox.types'

/** Copy + a11y ids for the recipient combobox (input + suggestion listbox). */
export const RECIPIENT_COMBOBOX = {
  walletsHeading: 'Your wallets',
  recentHeading: 'Recent',
  suggestionsLabel: 'Recipient suggestions',
  toggleLabel: 'Show recipient suggestions',
  listboxId: 'recipient-combobox-listbox',
  optionIdPrefix: 'recipient-combobox-option-',
  avatarSizePx: 20,
} as const

/** Secondary line per non-Native wallet source (Native shows its address instead). */
export const WALLET_SOURCE_SUBTITLE: Record<RecipientWalletSource, string | null> = {
  embedded: null,
  imported: 'Imported',
  external: 'External',
}
