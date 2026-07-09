import type { PortfolioWindow } from '../../../shared/domain'

export interface WindowSelectorProps {
  window: PortfolioWindow
  onSelect: (window: PortfolioWindow) => void
}

export interface WindowOptionProps {
  window: PortfolioWindow
  isActive: boolean
  onSelect: (window: PortfolioWindow) => void
}
