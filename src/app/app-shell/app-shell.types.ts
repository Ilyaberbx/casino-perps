import type { To } from 'react-router-dom'
import type { ReactNode } from 'react'

/** Passed to route pages via `<Outlet context>`. On mobile chrome routes it
 * carries the app-level header controls (venue switcher + spectate launcher) so
 * each page renders them in its own header row instead of a second stacked bar;
 * `null` on desktop / non-chrome routes. */
export interface AppShellOutletContext {
  mobileHeaderControls: ReactNode
}

export interface UseAppShellReturn {
  tradeTo: To
  portfolioTo: To
  /** Header mascot, swapped per theme so it stays legible on both backgrounds. */
  logoSrc: string
}

export interface NavLinkClassNameArgs {
  isActive: boolean
}
