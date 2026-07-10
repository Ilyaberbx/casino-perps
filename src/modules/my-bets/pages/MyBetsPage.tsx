import styles from './my-bets-page.module.css'

/**
 * My Bets stub (PRD 0008 D11 + D15, build order step 7).
 *
 * The `/my-bets` route. Replaces the old `/portfolio` page: a cash balance,
 * live bets, and settled history rebuilt in casino vocabulary with `chart.js`
 * dropped. That rebuild is the "My Bets" phase; this placeholder keeps the lazy
 * route mountable until then. Kept in its own module so the code-split boundary
 * the router relies on (`lazy: () => import('@/modules/my-bets')`) stays valid.
 */
export function MyBetsPage() {
  return (
    <div className={styles.page} data-testid="my-bets-page">
      <h1 className={styles.title}>My Bets</h1>
      <p className={styles.placeholder}>Your bets and cash balance load here soon.</p>
    </div>
  )
}
