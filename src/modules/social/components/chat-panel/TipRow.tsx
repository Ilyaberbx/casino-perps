import { Gift } from 'lucide-react'
import { formatUsd } from '../../social.utils'
import styles from './chat-panel.module.css'
import type { TipRowProps } from './chat-panel.types'

export function TipRow({ message }: TipRowProps) {
  return (
    <div className={styles.tip} data-testid="chat-tip">
      <span className={styles.tipIcon}>
        <Gift size={16} aria-hidden="true" />
      </span>
      <span>
        <strong>{message.fromName}</strong> tipped <strong>{message.toName}</strong>
      </span>
      <span className={styles.tipAmount}>{formatUsd(message.amountUsd, 2)}</span>
    </div>
  )
}
