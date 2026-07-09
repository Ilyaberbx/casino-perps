import { useSearchParams } from 'react-router-dom'
import { ApiError } from '@/modules/shared/http'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import styles from './dev-crash.module.css'

/**
 * DEV-ONLY harness for the error boundary — reachable at `/dev/crash` (the route
 * is only registered when `import.meta.env.DEV`, so it never ships). Landing on
 * it shows a menu; each button reloads with a `?kind=…` that throws during
 * render, so the throw bubbles to {@link RouteErrorBoundary} and you see the
 * real crash screen (not a mock).
 *
 * - `?kind=error` → a generic `Error` (the plain crash screen).
 * - `?kind=http`  → an `ApiError` carrying a `requestId` (shows the correlation
 *   chip in Technical details).
 */
export function DevCrashPage() {
  const [params] = useSearchParams()
  const kind = params.get('kind')

  if (kind === 'http') {
    throw new ApiError(500, '/api/portfolio', { message: 'Internal Server Error' }, 'req-dev-abc123')
  }

  if (kind === 'error') {
    throw new Error("Cannot read properties of undefined (reading 'accountValue')")
  }

  return (
    <main className={styles.root}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Dev harness</p>
        <h1 className={styles.title}>Error boundary preview</h1>
        <p className={styles.body}>
          Trigger a crash to see the real error screen. This route is dev-only and never ships to
          production.
        </p>

        <div className={styles.actions}>
          <PixelButton as="a" href="?kind=error" variant="accentFilled" size="md" elevated>
            Render error
          </PixelButton>
          <PixelButton as="a" href="?kind=http" variant="accent" size="md">
            HTTP error (with request id)
          </PixelButton>
        </div>
      </section>
    </main>
  )
}
