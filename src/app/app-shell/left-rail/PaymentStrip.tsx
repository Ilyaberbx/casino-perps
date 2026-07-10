import styles from './payment-strip.module.css'

/** The decorative payment-method strip beneath ADD CASH (PRD 0008 §6, mirrors
 * yeet). Pure decoration — `aria-hidden`, no links, no logic. Text marks stand in
 * for the brand logos so nothing external is fetched. */
export function PaymentStrip() {
  return (
    <div className={styles.strip} aria-hidden="true">
      <span className={`${styles.mark} ${styles.visa}`}>VISA</span>
      <span className={`${styles.mark} ${styles.applePay}`}>&#63743;Pay</span>
      <span className={`${styles.mark} ${styles.mastercard}`}>
        <span className={styles.mcRing} />
        <span className={`${styles.mcRing} ${styles.mcRingRight}`} />
      </span>
      <span className={`${styles.mark} ${styles.googlePay}`}>GPay</span>
    </div>
  )
}
