import type { ResultAsync } from 'neverthrow'
import type { Unsubscribe } from '../domain.types'
import type {
  PortfolioSnapshot,
  PortfolioMetric,
  PortfolioWindow,
  PortfolioPoint,
  PortfolioAccountScope,
} from '../portfolio.types'
import type { PortfolioHistoryError } from '../portfolio'

export interface PortfolioReader {
  subscribeSnapshot(
    scope: PortfolioAccountScope,
    onUpdate: (snapshot: PortfolioSnapshot) => void,
  ): Unsubscribe
  getHistory(
    metric: PortfolioMetric,
    window: PortfolioWindow,
    scope: PortfolioAccountScope,
  ): ResultAsync<PortfolioPoint[], PortfolioHistoryError>
}
