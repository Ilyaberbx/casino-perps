import { useContext, useEffect } from 'react'
import { ResultAsync } from 'neverthrow'
import { logger } from '@/app/logger'
import { formatWalletAddress } from '@/modules/shared/utils/format-wallet-address'
import { SpectateContext } from '../../providers/spectate-provider/spectate-provider.context'
import type { SpectateBannerViewModel } from './spectate-banner.types'

const log = logger.child({ module: 'spectate-banner' })

const NOOP = (): void => {}

export function useSpectateBanner(): SpectateBannerViewModel {
  // Read the context directly (not via useSpectate, which throws) so the banner
  // is inert when no SpectateProvider is mounted — e.g. isolated routing tests.
  const spectate = useContext(SpectateContext)

  const isSpectating = spectate?.isSpectating ?? false
  const stopSpectating = spectate?.stopSpectating ?? NOOP

  useEffect(() => {
    if (!isSpectating) return

    function onKeyDown(event: KeyboardEvent): void {
      const isCtrlX = event.ctrlKey && event.key.toLowerCase() === 'x'
      if (!isCtrlX) return
      event.preventDefault()
      stopSpectating()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSpectating, stopSpectating])

  const spectatedAddress = spectate?.spectatedAddress ?? null
  const hasSpectatedAddress = spectatedAddress !== null
  const visible = isSpectating && hasSpectatedAddress
  const truncatedAddress = hasSpectatedAddress ? formatWalletAddress(spectatedAddress) : ''

  async function onShare(): Promise<void> {
    const copy = ResultAsync.fromPromise(
      navigator.clipboard.writeText(window.location.href),
      (cause) => cause,
    )
    const result = await copy
    if (result.isErr()) {
      log.warn({ errorMessage: 'clipboard write failed' }, 'share failed')
    }
  }

  return {
    visible,
    truncatedAddress,
    onShare,
    onStop: stopSpectating,
  }
}
