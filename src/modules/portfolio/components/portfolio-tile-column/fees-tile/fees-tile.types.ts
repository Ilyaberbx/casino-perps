/** Which market's fees the compact (Simple-mode) selector is showing. */
export type FeesMarket = 'perps' | 'spot'

export type FeesTileState =
  | { kind: 'unsupported' }
  | { kind: 'loading' }
  | { kind: 'ready'; perpsTakerFee: string; perpsMakerFee: string; spotTakerFee: string; spotMakerFee: string }

/** The taker/maker pair for the market the Simple-mode selector has chosen. */
export interface SelectedMarketFees {
  readonly taker: string
  readonly maker: string
}

export interface UseFeesTileReturn {
  state: FeesTileState
  /** Simple mode renders the compact selector; Pro keeps both rows (#274). */
  isSimple: boolean
  selectedMarket: FeesMarket
  /** Narrows the raw select value to a `FeesMarket` before committing it. */
  onSelectMarket: (value: string) => void
  /** Taker/maker for `selectedMarket`; `null` unless `state.kind === 'ready'`. */
  selectedMarketFees: SelectedMarketFees | null
  isModalOpen: boolean
  onViewFeeSchedule: () => void
  onCloseModal: () => void
}
