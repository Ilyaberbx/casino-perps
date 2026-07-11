import { HeroScene } from './HeroScene'
import styles from './hero-banner.module.css'

/**
 * Lobby hero banner (PRD 0008, lobby phase). Teal panel with a display-face
 * headline whose single closing phrase is highlighted magenta — the yeet-lobby
 * reference treatment — over a decorative synthwave SVG scene (HeroScene).
 * Dumb + self-contained: the copy is fixed, so it takes no props and holds no
 * state. The shell renders the LIVE WINS ticker above this; the banner never
 * renders one itself.
 */
export function HeroBanner() {
  return (
    <section className={styles.banner} aria-label="Welcome">
      <div className={styles.scene} aria-hidden="true">
        <HeroScene />
      </div>
      <h1 className={styles.headline}>
        Every market is a game. Pick one and bet{' '}
        <span className={styles.accent}>up or down.</span>
      </h1>
      <p className={styles.subline}>
        Tap a market, choose your amount, and ride it. Hundreds of coins, one tap away.
      </p>
    </section>
  )
}
