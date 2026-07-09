import { formatWalletAddress } from '@/modules/shared/utils/format-wallet-address'
import { RECIPIENT_COMBOBOX, WALLET_SOURCE_SUBTITLE } from './recipient-combobox.constants'
import type {
  RecipientGroup,
  RecipientOption,
  RecipientSuggestion,
  RecipientWallet,
} from './recipient-combobox.types'

/** Case-insensitive equality against an optional "self" address. */
function isSelfAddress(address: string, selfAddress: string | null): boolean {
  return selfAddress !== null && address.toLowerCase() === selfAddress.toLowerCase()
}

/**
 * Map the user's own wallets to recipient suggestions. When `selfAddress` is set
 * that wallet is dropped (used by Send, where sending to yourself is blocked);
 * pass `null` to keep every wallet (used by Withdraw, where your own wallet is the
 * intended default). The Native (embedded) wallet shows the `Native` title over
 * its address; imported / external wallets show the truncated address over the
 * source word.
 */
export function buildWalletRecipientSuggestions(
  wallets: ReadonlyArray<RecipientWallet>,
  selfAddress: string | null,
): ReadonlyArray<RecipientSuggestion> {
  const out: RecipientSuggestion[] = []
  for (const wallet of wallets) {
    if (isSelfAddress(wallet.address, selfAddress)) continue
    const isNative = wallet.source === 'embedded'
    const address = formatWalletAddress(wallet.address)
    const title = isNative ? 'Native' : address
    const subtitle = isNative ? address : WALLET_SOURCE_SUBTITLE[wallet.source]
    out.push({ address: wallet.address, title, subtitle })
  }
  return out
}

/**
 * Map recently-sent addresses to title-only suggestions. Drops any address that is
 * already one of the user's own wallets (shown under "Your wallets") or the
 * optional `selfAddress`, so the two groups never duplicate an entry.
 */
export function buildRecentRecipientSuggestions(
  recents: ReadonlyArray<string>,
  wallets: ReadonlyArray<RecipientWallet>,
  selfAddress: string | null,
): ReadonlyArray<RecipientSuggestion> {
  const ownAddresses = new Set(wallets.map((wallet) => wallet.address.toLowerCase()))
  const out: RecipientSuggestion[] = []
  for (const address of recents) {
    const isOwnWallet = ownAddresses.has(address.toLowerCase())
    if (isOwnWallet || isSelfAddress(address, selfAddress)) continue
    out.push({ address, title: formatWalletAddress(address), subtitle: null })
  }
  return out
}

/**
 * Substring-filter a suggestion list against the typed query, matching the raw
 * address, the display title, or the subtitle. An empty query returns the list
 * unchanged (focus shows everything).
 */
export function filterRecipientSuggestions(
  list: ReadonlyArray<RecipientSuggestion>,
  query: string,
): ReadonlyArray<RecipientSuggestion> {
  const needle = query.trim().toLowerCase()
  if (needle === '') return list
  return list.filter((suggestion) => {
    const matchesAddress = suggestion.address.toLowerCase().includes(needle)
    const matchesTitle = suggestion.title.toLowerCase().includes(needle)
    const matchesSubtitle =
      suggestion.subtitle !== null && suggestion.subtitle.toLowerCase().includes(needle)
    return matchesAddress || matchesTitle || matchesSubtitle
  })
}

/**
 * Assemble the rendered groups from the two filtered lists over one shared flat
 * index space (wallets first, then recents) so the arrow-key cursor crosses both.
 * Empty groups are omitted. `activeIndex` marks the highlighted row. Returns the
 * groups plus the total option count (for active-index clamping).
 */
export function buildRecipientGroups(
  wallets: ReadonlyArray<RecipientSuggestion>,
  recents: ReadonlyArray<RecipientSuggestion>,
  activeIndex: number,
): { groups: ReadonlyArray<RecipientGroup>; flatCount: number } {
  let next = 0
  const toOption = (suggestion: RecipientSuggestion): RecipientOption => {
    const index = next
    next += 1
    return {
      ...suggestion,
      index,
      id: `${RECIPIENT_COMBOBOX.optionIdPrefix}${index}`,
      isActive: index === activeIndex,
    }
  }
  const groups: RecipientGroup[] = []
  if (wallets.length > 0) {
    groups.push({ heading: RECIPIENT_COMBOBOX.walletsHeading, options: wallets.map(toOption) })
  }
  if (recents.length > 0) {
    groups.push({ heading: RECIPIENT_COMBOBOX.recentHeading, options: recents.map(toOption) })
  }
  return { groups, flatCount: next }
}

/** Clamp a candidate active index into `[0, count-1]`, or `-1` when the list is empty. */
export function clampActiveIndex(index: number, count: number): number {
  if (count === 0) return -1
  if (index < 0) return 0
  if (index > count - 1) return count - 1
  return index
}
