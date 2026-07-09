import styles from './address-qr.module.css'
import { useAddressQr } from './use-address-qr'
import { QR_DARK_FILL } from './address-qr.constants'
import type { AddressQrProps } from './address-qr.types'

export function AddressQr({ value, size }: AddressQrProps) {
  const { rects } = useAddressQr(value, size)

  if (rects === null) {
    return (
      <div className={styles.fallback} style={{ width: size, height: size }} role="img" aria-label="QR code unavailable">
        QR unavailable
      </div>
    )
  }

  return (
    <div className={styles.frame}>
      <svg
        className={styles.svg}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        shapeRendering="crispEdges"
        role="img"
        aria-label="Receive address QR code"
      >
        {rects.map((rect) => (
          <rect
            key={rect.key}
            x={rect.x}
            y={rect.y}
            width={rect.side}
            height={rect.side}
            fill={QR_DARK_FILL}
          />
        ))}
      </svg>
    </div>
  )
}
