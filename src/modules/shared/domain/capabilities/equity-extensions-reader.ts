import type { Unsubscribe } from '../domain.types'
import type { PortfolioAccountScope } from '../portfolio.types'

export interface EquityExtensionBucket {
  readonly key: string
  readonly label: string
  readonly amountUsd: number
  readonly hint?: string
}

export interface EquityExtensionsReader {
  subscribe(
    scope: PortfolioAccountScope,
    onUpdate: (buckets: ReadonlyArray<EquityExtensionBucket>) => void,
  ): Unsubscribe
}
