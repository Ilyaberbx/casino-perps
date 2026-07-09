import {
  CancelTwapError,
  ModifyOrderError,
  PlaceOrderError,
  SetPositionProtectionError,
} from '@/modules/shared/domain'
import { describe, expect, it } from 'vitest'
import { buildCloseErrorToast } from '../close-position-toast.utils'
import { buildModifyErrorToast } from '../modify-order-toast.utils'
import { buildProtectionErrorToast } from '../position-protection-toast.utils'
import { buildTwapCancelErrorToast } from '../twap-cancel-toast.utils'
import { buildVenueErrorToast } from '../venue-error-toast.utils'

describe('buildVenueErrorToast', () => {
  it('builds an error toast without an id when toastId is omitted', () => {
    const payload = buildVenueErrorToast({
      title: 'Action failed',
      error: { message: 'something broke' },
    })

    expect(payload).toEqual({
      variant: 'error',
      title: 'Action failed',
      description: 'something broke',
    })
    expect('id' in payload).toBe(false)
  })

  it('includes the id when toastId is provided', () => {
    const payload = buildVenueErrorToast({
      toastId: 'cloid-1',
      title: 'Action failed',
      error: { message: 'something broke' },
    })

    expect(payload).toEqual({
      id: 'cloid-1',
      variant: 'error',
      title: 'Action failed',
      description: 'something broke',
    })
  })

  it('strips the venue error prefix from the description', () => {
    const payload = buildVenueErrorToast({
      title: 'Action failed',
      error: { message: 'Hyperliquid API error: insufficient margin' },
    })

    expect(payload.description).toBe('insufficient margin')
  })
})

describe('account-dock error toast builders delegate to the shared helper', () => {
  const PREFIXED_MESSAGE = 'Hyperliquid API error: rejected'

  it('buildCloseErrorToast keeps its id + title and strips the prefix', () => {
    const error = new PlaceOrderError('rejected', PREFIXED_MESSAGE)
    expect(buildCloseErrorToast('cloid-9', error)).toEqual({
      id: 'cloid-9',
      variant: 'error',
      title: 'Close rejected',
      description: 'rejected',
    })
  })

  it('buildModifyErrorToast keeps its title and strips the prefix', () => {
    const error = new ModifyOrderError('rejected', PREFIXED_MESSAGE)
    expect(buildModifyErrorToast(error)).toEqual({
      variant: 'error',
      title: 'Order not modified',
      description: 'rejected',
    })
  })

  it('buildProtectionErrorToast keeps its title and strips the prefix', () => {
    const error = new SetPositionProtectionError('rejected', PREFIXED_MESSAGE)
    expect(buildProtectionErrorToast(error)).toEqual({
      variant: 'error',
      title: 'TP/SL not updated',
      description: 'rejected',
    })
  })

  it('buildTwapCancelErrorToast keeps its title and strips the prefix', () => {
    const error = new CancelTwapError('rejected', PREFIXED_MESSAGE)
    expect(buildTwapCancelErrorToast(error)).toEqual({
      variant: 'error',
      title: 'TWAP not cancelled',
      description: 'rejected',
    })
  })
})
