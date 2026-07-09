import type { CSSProperties } from 'react'
import { Modal } from '@/modules/shared/components/modal'
import { Sheet } from '@/modules/shared/components/Sheet'
import { PnlCard } from './PnlCard'
import { PnlCardPickers } from './PnlCardPickers'
import { PnlCardActions } from './PnlCardActions'
import { usePnlCardModal } from './use-pnl-card-modal'
import styles from './pnl-card-modal.module.css'
import type { PnlCardModalBodyProps, PnlCardModalProps } from './pnl-card.types'

const ARIA_LABEL = 'Share PnL card'

// Single, self-mounting share modal (reused by every entry point). Driven by a
// `view | null` prop, mirroring `ClosePositionDialog`. Desktop renders a
// two-column layout (preview left, controls right) in a `Modal`; mobile stacks
// preview → pickers → actions in a bottom `Sheet`.
export function PnlCardModal({ view, isMobile, onClose }: PnlCardModalProps) {
  const modal = usePnlCardModal({ view })
  const isOpen = view !== null
  const body = view !== null ? <PnlCardModalBody view={view} modal={modal} /> : null

  if (isMobile) {
    return (
      <Sheet isOpen={isOpen} onClose={onClose} side="bottom" ariaLabel={ARIA_LABEL} title={ARIA_LABEL}>
        {body}
      </Sheet>
    )
  }
  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel={ARIA_LABEL} title={ARIA_LABEL} size="lg">
      {body}
    </Modal>
  )
}

function PnlCardModalBody({ view, modal }: PnlCardModalBodyProps) {
  const {
    displayMode,
    setDisplayMode,
    selection,
    displayedSelection,
    iconDataUrl,
    isIconResolving,
    onStepPlanet,
    onStepMascot,
    onSetTheme,
    planetLabel,
    mascotLabel,
    canToggle,
    cardRef,
    previewViewportRef,
    previewScale,
    isExporting,
    onShareNative,
    onDownload,
    onCopyImage,
    onCopyLink,
    onShareToX,
    onShareToTelegram,
  } = modal
  const viewportStyle = { ['--pnl-preview-scale']: previewScale } as CSSProperties

  return (
    <div className={styles.modalBody}>
      <div className={styles.previewColumn}>
        <div className={styles.previewViewport} ref={previewViewportRef} style={viewportStyle}>
          <div className={styles.previewScaler}>
            <PnlCard
              view={view}
              displayMode={displayMode}
              selection={displayedSelection}
              iconDataUrl={iconDataUrl}
              isIconResolving={isIconResolving}
              ref={cardRef}
            />
          </div>
        </div>
      </div>
      <div className={styles.controlsColumn}>
        <PnlCardPickers
          selection={selection}
          planetLabel={planetLabel}
          mascotLabel={mascotLabel}
          displayMode={displayMode}
          canToggle={canToggle}
          onStepPlanet={onStepPlanet}
          onStepMascot={onStepMascot}
          onSetTheme={onSetTheme}
          setDisplayMode={setDisplayMode}
        />
        <PnlCardActions
          isExporting={isExporting}
          onShareNative={onShareNative}
          onDownload={onDownload}
          onCopyImage={onCopyImage}
          onCopyLink={onCopyLink}
          onShareToX={onShareToX}
          onShareToTelegram={onShareToTelegram}
        />
      </div>
    </div>
  )
}
