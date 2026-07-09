import { tradingConfig } from '../../trading.config'
import {
  ORDER_DISCLAIMER_LINK_LABEL,
  ORDER_DISCLAIMER_PREFIX,
  ORDER_DISCLAIMER_SUFFIX,
} from './order-entry.constants'
import styles from './order-entry.module.css'

/** Muted legal line shown below the pre-trade summary for every order type
 *  (IA panel hierarchy row 12). "Terms of Use" links to the canonical landing
 *  page (ADR-0075). Static, prop-less. */
export function DisclaimerFooter() {
  return (
    <p className={styles.disclaimer}>
      {ORDER_DISCLAIMER_PREFIX}
      <a
        className={styles.disclaimerLink}
        href={tradingConfig.termsUrl}
        target="_blank"
        rel="noreferrer"
      >
        {ORDER_DISCLAIMER_LINK_LABEL}
      </a>
      {ORDER_DISCLAIMER_SUFFIX}
    </p>
  )
}
