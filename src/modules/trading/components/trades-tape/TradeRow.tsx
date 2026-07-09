import styles from './trades-tape.module.css'
import { ExternalLinkIcon } from '@/modules/shared/components/ExternalLinkIcon'
import { formatPrice } from '@/modules/shared/utils/format-price'
import {
  formatIsoTimestamp,
  formatSize,
  formatTime,
  gridVariant,
  rowClass,
} from './trades-tape.utils'
import type { ParticipantCellProps, TradeRowProps } from './trades-tape.types'

export function TradeRow({
  trade,
  priceSpec,
  sizeAsset,
  showParticipants,
  hoveredAddress,
  onHoverAddress,
  onLeaveAddress,
  onSpectateAddress,
  explorerTxUrl,
}: TradeRowProps) {
  const isBuy = trade.side === 'buy'
  const priceClassName = isBuy
    ? `${styles.price} ${styles.priceBuy}`
    : `${styles.price} ${styles.priceSell}`

  const displaySize = sizeAsset === 'quote' ? trade.size * trade.price : trade.size
  const isoTimestamp = formatIsoTimestamp(trade.timestamp)
  const hasExplorer = explorerTxUrl !== undefined
  const transactionHash = trade.transactionHash
  const variant = gridVariant(showParticipants, hasExplorer)
  const className = rowClass(variant, styles)

  return (
    <div className={className}>
      <span className={styles.time} title={isoTimestamp}>
        {formatTime(trade.timestamp)}
      </span>
      <span className={priceClassName}>{formatPrice(trade.price, priceSpec)}</span>
      <span className={styles.size}>{formatSize(displaySize)}</span>
      {showParticipants ? (
        <>
          <ParticipantCell
            role="Taker"
            address={trade.takerAddress}
            hoveredAddress={hoveredAddress}
            onHoverAddress={onHoverAddress}
            onLeaveAddress={onLeaveAddress}
            onSpectateAddress={onSpectateAddress}
          />
          <ParticipantCell
            role="Maker"
            address={trade.makerAddress}
            hoveredAddress={hoveredAddress}
            onHoverAddress={onHoverAddress}
            onLeaveAddress={onLeaveAddress}
            onSpectateAddress={onSpectateAddress}
          />
        </>
      ) : null}
      {hasExplorer ? (
        <span className={styles.tx}>
          {transactionHash !== undefined ? (
            <a
              className={styles.txLink}
              href={explorerTxUrl(transactionHash)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View transaction ${transactionHash} on the explorer`}
              title={transactionHash}
            >
              <ExternalLinkIcon />
            </a>
          ) : null}
        </span>
      ) : null}
    </div>
  )
}

function ParticipantCell({
  role,
  address,
  hoveredAddress,
  onHoverAddress,
  onLeaveAddress,
  onSpectateAddress,
}: ParticipantCellProps) {
  if (address === undefined) {
    return <span className={styles.participant} aria-hidden="true" />
  }

  const isMatched = hoveredAddress !== null && hoveredAddress === address
  const buttonClassName = isMatched
    ? `${styles.spectateButton} ${styles.spectateButtonMatched}`
    : styles.spectateButton

  return (
    <span className={styles.participant}>
      <button
        type="button"
        className={buttonClassName}
        aria-label={`Spectate ${role} ${address}`}
        title={`Spectate ${role}: ${address}`}
        onClick={() => onSpectateAddress(address)}
        onMouseEnter={() => onHoverAddress(address)}
        onMouseLeave={onLeaveAddress}
        onFocus={() => onHoverAddress(address)}
        onBlur={onLeaveAddress}
      >
        <span className={styles.ghostIcon} aria-hidden="true" />
      </button>
    </span>
  )
}
