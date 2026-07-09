import whitejawMascot from '@/assets/sprites/whitejaw.gif'
import blackjawMascot from '@/assets/sprites/blackjaw.gif'
import { useThemeContext } from '@/modules/shared/providers/theme-provider'
import { useSpectateLink } from '@/modules/spectate'
import type { UseAppShellReturn } from './app-shell.types'

export function useAppShell(): UseAppShellReturn {
  const { theme } = useThemeContext()
  // The white mascot reads on the dark theme; the black one on the light
  // ('white') theme — mirrors the favicon swap in the theme provider. The theme
  // switch itself now lives in Settings → Appearance (#256), not the header.
  const logoSrc = theme === 'dark' ? whitejawMascot : blackjawMascot
  const buildSpectateLink = useSpectateLink()
  const tradeTo = buildSpectateLink('/trade')
  const portfolioTo = buildSpectateLink('/portfolio')
  return { tradeTo, portfolioTo, logoSrc }
}
