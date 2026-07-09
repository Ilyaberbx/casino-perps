import styles from './copyable-address.module.css'
import { AddressQr } from '@/modules/shared/components/address-qr'
import { useCopyableAddress } from './use-copyable-address'
import type { CopyableAddressProps } from './copyable-address.types'

export function CopyableAddress({ address, qrSize, align = 'center' }: CopyableAddressProps) {
  const { truncated, handleCopy } = useCopyableAddress(address)

  const alignClass = align === 'start' ? styles.alignStart : styles.alignCenter
  const wrapClass = `${styles.wrap} ${alignClass}`

  return (
    <div className={wrapClass} data-align={align}>
      {qrSize !== undefined && <AddressQr value={address} size={qrSize} />}
      <div className={styles.row}>
        <span className={styles.address} title={address}>
          {truncated}
        </span>
        <button
          type="button"
          className={styles.copyButton}
          onClick={handleCopy}
          aria-label="Copy address"
        >
          Copy
        </button>
      </div>
    </div>
  )
}
