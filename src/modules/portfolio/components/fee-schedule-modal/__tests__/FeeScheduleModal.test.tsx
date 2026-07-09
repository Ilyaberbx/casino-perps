import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FeeSchedule, FeeScheduleReader, Venue } from '@/modules/shared/domain'
import { VenueContext } from '@/modules/shared/providers/venue-provider/venue-provider.context'
import { FeeScheduleModal } from '../FeeScheduleModal'

function buildReader(schedule: FeeSchedule): FeeScheduleReader {
  return {
    subscribe(onUpdate) {
      onUpdate(schedule)
      return () => {}
    },
  }
}

function buildSchedule(partial: Partial<FeeSchedule> = {}): FeeSchedule {
  return {
    tiers: [],
    currentTierKey: null,
    volumeTiers: [],
    makerRebateTiers: [],
    stakingDiscountTiers: [],
    referralDiscount: 0,
    activeReferralDiscount: 0,
    activeStakingDiscount: { bpsOfMaxSupply: 0, discount: 0 },
    userPerpsTakerRate: 0,
    userPerpsMakerRate: 0,
    userSpotTakerRate: 0,
    userSpotMakerRate: 0,
    ...partial,
  }
}

function buildVenue(schedule: FeeSchedule | null): Venue {
  return {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
      feeSchedule: schedule === null ? undefined : buildReader(schedule),
    },
  }
}

function renderModal(venue: Venue, isOpen = true) {
  return render(
    <VenueContext.Provider value={venue}>
      <FeeScheduleModal isOpen={isOpen} onClose={() => {}} />
    </VenueContext.Provider>,
  )
}

describe('FeeScheduleModal', () => {
  it('renders the four section headings', () => {
    renderModal(buildVenue(buildSchedule()))
    expect(screen.getByRole('heading', { name: /referral discount/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /staking discount/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /maker rebate/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /volume tier/i })).toBeInTheDocument()
  })

  it('shows "No referral discount" when activeReferralDiscount is 0', () => {
    renderModal(buildVenue(buildSchedule({ activeReferralDiscount: 0 })))
    expect(screen.getByText(/no referral discount/i)).toBeInTheDocument()
  })

  it('shows the active referral discount percentage when non-zero', () => {
    renderModal(buildVenue(buildSchedule({ activeReferralDiscount: 0.04 })))
    expect(screen.getByTestId('active-referral-discount')).toHaveTextContent('4%')
  })

  it('shows "No stake" when active staking discount is 0', () => {
    renderModal(
      buildVenue(buildSchedule({ activeStakingDiscount: { bpsOfMaxSupply: 0, discount: 0 } })),
    )
    expect(screen.getByText(/no stake/i)).toBeInTheDocument()
  })

  it('shows the active staking discount percentage when non-zero', () => {
    renderModal(
      buildVenue(
        buildSchedule({ activeStakingDiscount: { bpsOfMaxSupply: 2.5, discount: 0.1 } }),
      ),
    )
    expect(screen.getByTestId('active-staking-discount')).toHaveTextContent('10%')
  })

  it('shows "No rebate" badge in the Maker Rebate section by default', () => {
    renderModal(buildVenue(buildSchedule()))
    expect(screen.getByText(/no rebate/i)).toBeInTheDocument()
  })

  it('renders the Volume Tier table for the default Spot market type', () => {
    renderModal(
      buildVenue(
        buildSchedule({
          volumeTiers: [
            { key: 'tier-0', label: '0', notionalCutoff: 5_000_000, perpsTaker: 0.00045, perpsMaker: 0.00015, spotTaker: 0.0007, spotMaker: 0.0004 },
            { key: 'tier-1', label: '1', notionalCutoff: 25_000_000, perpsTaker: 0.0004, perpsMaker: 0.00012, spotTaker: 0.0006, spotMaker: 0.0003 },
          ],
        }),
      ),
    )
    const table = screen.getByTestId('volume-tier-table')
    expect(table).toHaveTextContent('0.07%')
    expect(table).toHaveTextContent('0.04%')
    expect(table).toHaveTextContent('≤ $5M')
  })

  it('switches the Volume Tier table to perps rates when the user toggles Market Type', async () => {
    const user = userEvent.setup()
    renderModal(
      buildVenue(
        buildSchedule({
          volumeTiers: [
            { key: 'tier-0', label: '0', notionalCutoff: 5_000_000, perpsTaker: 0.00045, perpsMaker: 0.00015, spotTaker: 0.0007, spotMaker: 0.0004 },
          ],
        }),
      ),
    )
    await user.click(screen.getByRole('button', { name: /perps/i }))
    const table = screen.getByTestId('volume-tier-table')
    expect(table).toHaveTextContent('0.045%')
    expect(table).toHaveTextContent('0.015%')
  })

  it('highlights the user\'s active tier when their spot taker rate matches a row', () => {
    renderModal(
      buildVenue(
        buildSchedule({
          volumeTiers: [
            { key: 'tier-0', label: '0', notionalCutoff: 5_000_000, perpsTaker: 0.00045, perpsMaker: 0.00015, spotTaker: 0.0007, spotMaker: 0.0004 },
            { key: 'tier-1', label: '1', notionalCutoff: 25_000_000, perpsTaker: 0.0004, perpsMaker: 0.00012, spotTaker: 0.0006, spotMaker: 0.0003 },
          ],
          userSpotTakerRate: 0.0006,
          userSpotMakerRate: 0.0003,
        }),
      ),
    )
    const row = screen.getByTestId('volume-tier-row-tier-1')
    expect(row).toHaveAttribute('data-active', 'true')
    const inactive = screen.getByTestId('volume-tier-row-tier-0')
    expect(inactive).toHaveAttribute('data-active', 'false')
  })

  it('renders gracefully with zero totals when the venue lacks a feeSchedule capability', () => {
    renderModal(buildVenue(null))
    expect(screen.getByRole('heading', { name: /fee schedule/i })).toBeInTheDocument()
    expect(screen.getByText(/no referral discount/i)).toBeInTheDocument()
  })

  it('stays mounted but hidden + inert when isOpen is false (keepMounted, issue #267)', () => {
    // keepMounted keeps the subscription warm so opening shows data with no
    // empty-frame flicker; the closed modal must be inert (non-interactive).
    renderModal(buildVenue(buildSchedule()), false)
    const backdrop = screen.getByTestId('modal-backdrop')
    expect(backdrop).toHaveAttribute('inert')
  })
})
