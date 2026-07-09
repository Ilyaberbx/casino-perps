export interface SpectateBannerViewModel {
  readonly visible: boolean
  readonly truncatedAddress: string
  readonly onShare: () => Promise<void>
  readonly onStop: () => void
}
