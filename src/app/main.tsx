import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './error-boundary'
import { registerIconCacheServiceWorker } from './register-icon-cache-sw'

registerIconCacheServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)

// Dismiss the pre-hydration boot splash (see apps/client/index.html) once React
// has painted. Two rAFs ensure a frame committed before the fade starts; the
// `transitionend` removal plus a timeout fallback (reduced-motion has no
// transition) tear the node down. See DESIGN.md "Loading & empty states".
const bootSplash = document.getElementById('boot-splash')
if (bootSplash) {
  const removeBootSplash = () => bootSplash.remove()
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      bootSplash.setAttribute('data-hidden', 'true')
      bootSplash.addEventListener('transitionend', removeBootSplash, { once: true })
      window.setTimeout(removeBootSplash, 500)
    }),
  )
}
