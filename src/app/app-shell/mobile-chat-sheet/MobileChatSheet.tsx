import { Sheet } from '@/modules/shared/components/Sheet'
import { ChatColumn } from '../chat-column/ChatColumn'
import styles from './mobile-chat-sheet.module.css'

export interface MobileChatSheetProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * The mobile Chat tab surface (< 1280px, where the chat column is dropped). The
 * bottom-nav "Chat" tab opens this sheet, which reuses {@link ChatColumn} so the
 * disclosure note travels with it.
 *
 * Mounts only while open — `Sheet` keeps closed children in the DOM (inert), and a second
 * always-mounted `ChatColumn` would run the fixture reel's timers twice.
 */
export function MobileChatSheet({ isOpen, onClose }: MobileChatSheetProps) {
  return (
    <Sheet isOpen={isOpen} onClose={onClose} side="right" ariaLabel="Chat" title="Chat">
      {isOpen && (
        <div className={styles.body} data-testid="mobile-chat-sheet">
          <ChatColumn />
        </div>
      )}
    </Sheet>
  )
}
