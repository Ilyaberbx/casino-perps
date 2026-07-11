import styles from './hero-banner.module.css'

/**
 * Decorative synthwave scene behind the hero copy — our own inline-SVG
 * composition (dusk glow, sun disc, skyline + palm silhouettes, perspective
 * grid) standing in for yeet's illustrated hero PNG. Pure vector: no bundled
 * bitmap, no external fetch, scales with the banner. Purely presentational
 * (aria-hidden on the wrapper); colors stay inside the casino palette.
 */
export function HeroScene() {
  return (
    <svg
      className={styles.sceneSvg}
      viewBox="0 0 800 300"
      preserveAspectRatio="xMaxYMax slice"
      role="presentation"
      focusable="false"
    >
      <defs>
        <radialGradient id="hero-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e870f2" stopOpacity="0.85" />
          <stop offset="55%" stopColor="#e870f2" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#e870f2" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hero-sun-disc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd9fb" />
          <stop offset="100%" stopColor="#e870f2" />
        </linearGradient>
        <g id="hero-palm">
          <path d="M-5 120 C 1 72 4 40 0 0 L 9 0 C 11 44 13 74 11 120 Z" />
          <path d="M2 4 C -26 -12 -56 -10 -74 6 C -50 0 -22 4 2 12 Z" />
          <path d="M1 2 C -19 -26 -45 -34 -66 -28 C -44 -20 -17 -6 2 10 Z" />
          <path d="M1 0 C -3 -34 -17 -52 -38 -58 C -24 -40 -9 -18 4 6 Z" />
          <path d="M3 0 C 13 -32 31 -46 54 -48 C 35 -32 19 -12 5 6 Z" />
          <path d="M4 2 C 30 -14 58 -14 76 2 C 54 -4 26 2 4 12 Z" />
        </g>
      </defs>

      {/* dusk glow + sun */}
      <circle cx="612" cy="118" r="150" fill="url(#hero-sun)" />
      <circle cx="612" cy="118" r="56" fill="url(#hero-sun-disc)" opacity="0.9" />

      {/* pink cloud streaks */}
      <rect x="440" y="58" width="150" height="10" rx="5" fill="#e870f2" opacity="0.28" />
      <rect x="520" y="86" width="96" height="8" rx="4" fill="#e870f2" opacity="0.2" />
      <rect x="660" y="72" width="110" height="9" rx="4.5" fill="#e870f2" opacity="0.24" />

      {/* skyline silhouette */}
      <path
        d="M320 300 V232 h26 v-34 h22 v34 h18 v-58 h30 v58 h14 v-26 h26 v26 h16 v-78 h12 v-16 h10 v16 h12 v78 h18 v-44 h28 v44 h14 v-62 h30 v62 h16 v-30 h24 v30 h14 v-52 h28 v52 h20 v-24 h22 v24 h14 v-40 h26 v40 h20 v-18 h20 v66 H320 Z"
        fill="rgba(7, 32, 38, 0.78)"
      />
      {/* lit windows */}
      <g fill="rgba(80, 215, 233, 0.5)">
        <rect x="424" y="188" width="4" height="5" />
        <rect x="436" y="204" width="4" height="5" />
        <rect x="522" y="216" width="4" height="5" />
        <rect x="560" y="196" width="4" height="5" />
        <rect x="612" y="228" width="4" height="5" />
        <rect x="668" y="222" width="4" height="5" />
        <rect x="716" y="238" width="4" height="5" />
      </g>

      {/* perspective grid */}
      <g stroke="rgba(80, 215, 233, 0.2)" strokeWidth="1">
        <line x1="300" y1="258" x2="800" y2="258" />
        <line x1="300" y1="272" x2="800" y2="272" />
        <line x1="300" y1="288" x2="800" y2="288" />
        <line x1="560" y1="248" x2="380" y2="300" />
        <line x1="600" y1="248" x2="540" y2="300" />
        <line x1="640" y1="248" x2="700" y2="300" />
        <line x1="680" y1="248" x2="800" y2="292" />
      </g>

      {/* palms, front layer */}
      <g fill="rgba(5, 26, 31, 0.92)">
        <use href="#hero-palm" transform="translate(700 182) scale(1.15)" />
        <use href="#hero-palm" transform="translate(505 208) scale(0.85) scale(-1 1)" />
      </g>
    </svg>
  )
}
