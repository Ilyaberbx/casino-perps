import type { VolumeHistoryEntry } from '@/modules/shared/domain'

export const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function sumVolumeTotals(entries: ReadonlyArray<VolumeHistoryEntry>): {
  exchange: number
  maker: number
  taker: number
} {
  let exchange = 0
  let maker = 0
  let taker = 0
  for (const e of entries) {
    exchange += e.exchangeVolume
    maker += e.userMakerVolume
    taker += e.userTakerVolume
  }
  return { exchange, maker, taker }
}
