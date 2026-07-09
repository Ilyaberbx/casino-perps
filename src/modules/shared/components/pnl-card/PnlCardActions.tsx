import { PixelButton } from '@/modules/shared/components/pixel-button'
import styles from './pnl-card-modal.module.css'
import type { PnlCardActionsProps } from './pnl-card.types'

// The share actions. `Share` is the native path (Web Share API) — it attaches
// the PNG to the post via the OS share sheet (X / Telegram apps), falling back
// to the X composer where files can't be shared. `Share to X` / `Share to
// Telegram` open the respective web composer (text + link) and download the PNG
// for manual attach. Download / Copy image / Copy link are client-only (ADR-0037).
export function PnlCardActions({
  isExporting,
  onShareNative,
  onDownload,
  onCopyImage,
  onCopyLink,
  onShareToX,
  onShareToTelegram,
}: PnlCardActionsProps) {
  return (
    <div className={styles.section}>
      <span className={styles.sectionLabel}>Share</span>
      <div className={styles.actions}>
        <PixelButton
          className={styles.primaryAction}
          variant="accentFilled"
          size="md"
          elevated
          fullWidth
          disabled={isExporting}
          aria-label="Share PnL card with image"
          onClick={onShareNative}
        >
          Share
        </PixelButton>
        <div className={styles.actionGrid}>
          <PixelButton
            variant="accent"
            size="md"
            elevated
            fullWidth
            disabled={isExporting}
            aria-label="Share PnL card to X"
            onClick={onShareToX}
          >
            X
          </PixelButton>
          <PixelButton
            variant="accent"
            size="md"
            elevated
            fullWidth
            disabled={isExporting}
            aria-label="Share PnL card to Telegram"
            onClick={onShareToTelegram}
          >
            Telegram
          </PixelButton>
          <PixelButton
            variant="default"
            size="md"
            elevated
            fullWidth
            disabled={isExporting}
            aria-label="Download PnL card as PNG"
            onClick={onDownload}
          >
            Download
          </PixelButton>
          <PixelButton
            variant="default"
            size="md"
            elevated
            fullWidth
            disabled={isExporting}
            aria-label="Copy PnL card image"
            onClick={onCopyImage}
          >
            Copy image
          </PixelButton>
          <PixelButton
            variant="default"
            size="md"
            elevated
            fullWidth
            disabled={isExporting}
            aria-label="Copy market link"
            onClick={onCopyLink}
          >
            Copy link
          </PixelButton>
        </div>
      </div>
    </div>
  )
}
