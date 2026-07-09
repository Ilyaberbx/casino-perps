import { PixelButton } from '@/modules/shared/components/pixel-button'
import styles from './order-entry.module.css'
import type { StopSpectatingButtonProps } from './order-entry.types'

export function StopSpectatingButton({ onStopSpectating }: StopSpectatingButtonProps) {
  return (
    <div className={styles.submitWrapper}>
      <PixelButton
        variant="accent"
        size="md"
        fullWidth
        onClick={onStopSpectating}
        aria-label="Stop spectating (Ctrl+X)"
      >
        Stop Spectating
      </PixelButton>
    </div>
  )
}
