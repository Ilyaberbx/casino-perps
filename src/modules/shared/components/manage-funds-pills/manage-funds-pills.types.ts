import type { ManageFundsTab } from '../../providers/manage-funds-provider'

/** One header pill: which tab it deep-links and its visible label. */
export interface ManageFundsPill {
  readonly id: ManageFundsTab
  readonly label: string
}

export interface ManageFundsPillsContent {
  /**
   * `true` when the active venue exposes at least one of deposit / transfer /
   * withdraw. When false the whole row renders nothing.
   */
  readonly hasAnyCapability: boolean
  /** Simple mode collapses the row to one "Manage Funds" button (#272). */
  readonly isSimple: boolean
  readonly pills: ReadonlyArray<ManageFundsPill>
  /** The tab the single Simple-mode button deep-links to. */
  readonly simpleTab: ManageFundsTab
  onOpen(tab: ManageFundsTab): void
}
