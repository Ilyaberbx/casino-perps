import type { RailAction } from '../left-rail'

export interface MobileMenuDrawerProps {
  isOpen: boolean
  onClose: () => void
  authenticated: boolean
  onAddCash: () => void
  onRailAction: (action: RailAction) => void
  onLogIn: () => void
  onCreateAccount: () => void
}
