export interface MobileTopBarProps {
  /** Formatted perp equity ("$1,234.56") — the cash pill shows it in place of
   *  the "Add Cash" label when present. Null ⇒ signed out / nothing to show. */
  equityLabel: string | null
  onAddCash: () => void
  onOpenMenu: () => void
}
