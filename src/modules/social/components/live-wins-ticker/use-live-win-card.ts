import { useIconLadder } from '@/modules/shared/hooks/use-icon-ladder'
import { iconCandidatesForSymbol } from '@/modules/shared/utils/resolve-market-icon-url'
import { formatUsd, symbolGradient, symbolMonogram } from '../../social.utils'
import type { LiveWinCardProps } from './live-wins-ticker.types'

export interface UseLiveWinCardResult {
  readonly gradient: string
  /** Real token icon URL for the thumb, or null → render the monogram. */
  readonly iconSrc: string | null
  readonly monogram: string
  readonly username: string
  readonly amountLabel: string
  readonly onIconError: () => void
}

/**
 * Smart hook for a LIVE WINS mini poster tile — resolves the win's market to a
 * real token icon via the shared ladder (same plumbing as the lobby poster
 * cards), falling back to the display-face monogram when every rung errors.
 */
export function useLiveWinCard({ win }: Pick<LiveWinCardProps, 'win'>): UseLiveWinCardResult {
  const candidates = iconCandidatesForSymbol(win.market)
  const { src: iconSrc, onError: onIconError } = useIconLadder(win.market, candidates)

  return {
    gradient: symbolGradient(win.market),
    iconSrc,
    monogram: symbolMonogram(win.market),
    username: win.username,
    amountLabel: formatUsd(win.amountUsd),
    onIconError,
  }
}
