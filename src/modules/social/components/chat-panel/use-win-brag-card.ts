import { useIconLadder } from '@/modules/shared/hooks/use-icon-ladder'
import { iconCandidatesForSymbol } from '@/modules/shared/utils/resolve-market-icon-url'
import { formatMultiplier, symbolGradient, symbolMonogram } from '../../social.utils'
import type { WinBragCardProps } from './chat-panel.types'

export interface UseWinBragCardResult {
  readonly gradient: string
  /** Real token icon URL for the thumb, or null → render the monogram. */
  readonly iconSrc: string | null
  readonly monogram: string
  readonly multiplierLabel: string
  readonly onIconError: () => void
}

/**
 * Smart hook for the chat win-brag thumb — same shared icon ladder as the
 * lobby poster cards and LIVE WINS tiles, monogram fallback when it exhausts.
 */
export function useWinBragCard({ message }: Pick<WinBragCardProps, 'message'>): UseWinBragCardResult {
  const candidates = iconCandidatesForSymbol(message.market)
  const { src: iconSrc, onError: onIconError } = useIconLadder(message.market, candidates)

  return {
    gradient: symbolGradient(message.market),
    iconSrc,
    monogram: symbolMonogram(message.market),
    multiplierLabel: formatMultiplier(message.multiplier),
    onIconError,
  }
}
