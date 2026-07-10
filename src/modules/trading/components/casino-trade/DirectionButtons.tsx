import { PixelButton } from '@/modules/shared/components/pixel-button'
import type { DirectionButtonsProps } from './casino-trade.types'
import styles from './casino-trade.module.css'

/** [ UP ▲ ] [ DOWN ▼ ] — UP = --win, DOWN = --loss, both min-height 64px. */
export function DirectionButtons({ canBet, onPick }: DirectionButtonsProps) {
  return (
    <div className={styles.directions} data-testid="direction-buttons">
      <PixelButton
        variant="directionUp"
        fullWidth
        className={styles.directionButton}
        disabled={!canBet}
        onClick={() => onPick('up')}
        data-testid="bet-up"
      >
        UP ▲
      </PixelButton>
      <PixelButton
        variant="directionDown"
        fullWidth
        className={styles.directionButton}
        disabled={!canBet}
        onClick={() => onPick('down')}
        data-testid="bet-down"
      >
        DOWN ▼
      </PixelButton>
    </div>
  )
}
