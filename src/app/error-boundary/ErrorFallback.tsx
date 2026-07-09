import { PixelButton } from '@/modules/shared/components/pixel-button'
import { DiscordGlyph } from './DiscordGlyph'
import { XGlyph } from './XGlyph'
import { FaultGlyph } from './FaultGlyph'
import { ErrorDetails } from './ErrorDetails'
import { useErrorFallback } from './use-error-fallback'
import { ERROR_COPY } from './error-boundary.constants'
import styles from './error-boundary.module.css'
import type { ErrorFallbackProps } from './error-boundary.types'

/**
 * The full-screen crash takeover, shared by the class {@link AppErrorBoundary}
 * (render crashes) and the router {@link RouteErrorBoundary} (loader/route
 * errors). Reassures first (funds are safe), then routes the User to the two
 * things that matter: reload to recover, or hand us the log via Discord.
 */
export function ErrorFallback({ error }: ErrorFallbackProps) {
  const {
    normalized,
    report,
    copied,
    isClipboardSupported,
    discordInviteUrl,
    xUrl,
    copyReport,
    reload,
    goHome,
  } = useErrorFallback({ error })

  return (
    <main className={styles.root} role="alert" aria-labelledby="error-boundary-title">
      <div className={styles.backdrop} aria-hidden="true" />

      <section className={styles.card}>
        <span className={styles.glyph}>
          <FaultGlyph />
        </span>

        <p className={styles.eyebrow}>{ERROR_COPY.eyebrow}</p>

        <h1 id="error-boundary-title" className={styles.title}>
          {ERROR_COPY.title}
        </h1>

        <p className={styles.body}>{ERROR_COPY.body}</p>

        <div className={styles.helpBand}>
          <div className={styles.helpText}>
            <span className={styles.helpTitle}>{ERROR_COPY.helpTitle}</span>
            <span className={styles.helpSubtitle}>{ERROR_COPY.helpSubtitle}</span>
          </div>

          <div className={styles.helpActions}>
            {isClipboardSupported ? (
              <PixelButton variant="default" size="md" onClick={copyReport} aria-live="polite">
                {copied ? ERROR_COPY.copyDone : ERROR_COPY.copyIdle}
              </PixelButton>
            ) : null}

            <PixelButton
              as="a"
              href={discordInviteUrl}
              target="_blank"
              rel="noreferrer"
              variant="accent"
              size="md"
            >
              <DiscordGlyph />
              {ERROR_COPY.discordCta}
            </PixelButton>

            <PixelButton
              as="a"
              href={xUrl}
              target="_blank"
              rel="noreferrer"
              variant="default"
              size="md"
            >
              <XGlyph />
              {ERROR_COPY.xCta}
            </PixelButton>
          </div>
        </div>

        <ErrorDetails normalized={normalized} report={report} />

        <div className={styles.actions}>
          <PixelButton variant="accentFilled" size="md" elevated onClick={reload}>
            {ERROR_COPY.reload}
          </PixelButton>
          <PixelButton variant="default" size="md" onClick={goHome}>
            {ERROR_COPY.goHome}
          </PixelButton>
        </div>
      </section>
    </main>
  )
}
