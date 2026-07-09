import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePnlCardCaptureIcon } from '../use-pnl-card-capture-icon'
import { fromPositionSnapshot } from '../pnl-card.utils'
import { fakePositionSnapshot } from '../__fixtures__/pnl-card-fixtures'
import { buildIconMarket } from '@/modules/shared/utils/resolve-market-icon-url'

const MARKET = buildIconMarket('BTC', 'perp')
const VIEW_WITH_MARKET = fromPositionSnapshot(fakePositionSnapshot(), { market: MARKET })
const VIEW_NO_MARKET = fromPositionSnapshot(fakePositionSnapshot())

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('usePnlCardCaptureIcon', () => {
  it('inlines the first fetchable candidate into a data URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['<svg/>'], { type: 'image/svg+xml' })),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => usePnlCardCaptureIcon(VIEW_WITH_MARKET))
    await waitFor(() => expect(result.current.iconDataUrl).not.toBeNull())
    expect(result.current.iconDataUrl?.startsWith('data:')).toBe(true)
    expect(result.current.isIconResolving).toBe(false)
    // TradingView (CORS-capable) is first — it should be the one fetched.
    expect(fetchMock.mock.calls[0]?.[0]).toContain('tradingview.com')
  })

  it('falls through failing candidates and resolves null when none inline', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('CORS blocked'))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => usePnlCardCaptureIcon(VIEW_WITH_MARKET))
    await waitFor(() => expect(result.current.isIconResolving).toBe(false))
    expect(result.current.iconDataUrl).toBeNull()
    // Every candidate was attempted before giving up.
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0)
  })

  it('does nothing when the view has no market', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => usePnlCardCaptureIcon(VIEW_NO_MARKET))
    expect(result.current.iconDataUrl).toBeNull()
    expect(result.current.isIconResolving).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
