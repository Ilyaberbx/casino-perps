import { useTopBar } from './use-top-bar'
import { TopBarDesktop } from './TopBarDesktop'
import { TopBarMobile } from './TopBarMobile'
import type { TopBarProps } from './top-bar.types'

export function TopBar({ mobileAction }: TopBarProps = {}) {
  const vm = useTopBar()
  return vm.isMobile ? (
    <TopBarMobile {...vm} mobileAction={mobileAction} />
  ) : (
    <TopBarDesktop {...vm} />
  )
}
