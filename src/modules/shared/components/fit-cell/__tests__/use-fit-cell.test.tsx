import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useFitCell } from '../use-fit-cell'
import { MIN_SCALE } from '../fit-cell.constants'
import type { UseFitCellResult } from '../fit-cell.types'

/**
 * jsdom never lays out, so `clientWidth` / `scrollWidth` are always 0. The hook
 * observes the outer node; our `ResizeObserver` stand-in stamps the configured
 * widths onto that node (and its inner child) when `observe()` is called, then
 * fires the callback — mirroring the real measure-on-resize flow without
 * mutating the hook's returned refs (which the React Compiler forbids). The
 * `widths` cell is mutable so a test can simulate a column resize, then drive a
 * re-measure through the captured callback.
 */

interface Widths {
  container: number
  content: number
}

interface CapturedObserver {
  readonly callback: () => void
  readonly disconnect: ReturnType<typeof vi.fn>
}

let widths: Widths = { container: 0, content: 0 }
let observers: CapturedObserver[] = []

function stampWidth(node: Element, prop: 'clientWidth' | 'scrollWidth', value: number): void {
  Object.defineProperty(node, prop, { configurable: true, value })
}

beforeEach(() => {
  widths = { container: 0, content: 0 }
  observers = []
  class TestResizeObserver {
    private readonly callback: () => void
    readonly disconnect = vi.fn()
    readonly unobserve = vi.fn()
    constructor(callback: () => void) {
      this.callback = callback
      observers.push({ callback, disconnect: this.disconnect })
    }
    observe(target: Element): void {
      stampWidth(target, 'clientWidth', widths.container)
      const inner = target.firstElementChild
      if (inner !== null) stampWidth(inner, 'scrollWidth', widths.content)
      this.callback()
    }
  }
  vi.stubGlobal('ResizeObserver', TestResizeObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

interface HarnessProps {
  readonly onResult: (result: UseFitCellResult) => void
}

/** Attaches the hook's own refs directly — no mutation of the returned object. */
function Harness({ onResult }: HarnessProps) {
  const result = useFitCell()
  const { outerRef, innerRef } = result
  onResult(result)
  return (
    <span ref={outerRef}>
      <span ref={innerRef} />
    </span>
  )
}

function renderFit(container: number, content: number) {
  widths = { container, content }
  let latest: UseFitCellResult | undefined
  const utils = render(
    <Harness
      onResult={(r) => {
        latest = r
      }}
    />,
  )
  const getResult = () => {
    if (latest === undefined) throw new Error('hook never rendered')
    return latest
  }
  return {
    ...utils,
    getResult,
    getScale: () => getResult().scaleX,
    /** Change the measured widths and drive a re-measure via the observer. */
    resizeTo: (nextContainer: number, nextContent: number) => {
      widths = { container: nextContainer, content: nextContent }
      const outer = getResult().outerRef.current
      if (outer !== null) stampWidth(outer, 'clientWidth', nextContainer)
      const inner = getResult().innerRef.current
      if (inner !== null) stampWidth(inner, 'scrollWidth', nextContent)
      act(() => observers[0].callback())
    },
  }
}

it('returns scale 1 when the content fits the container', () => {
  const { getScale } = renderFit(100, 80)
  expect(getScale()).toBe(1)
})

it('compresses to containerWidth / contentWidth when the content overflows', () => {
  const { getScale } = renderFit(80, 100)
  expect(getScale()).toBeCloseTo(0.8)
})

it('clamps to MIN_SCALE when the content is far wider than the container', () => {
  const { getScale } = renderFit(50, 200)
  expect(getScale()).toBe(MIN_SCALE)
})

it('observes the outer element and disconnects the observer on unmount', () => {
  const { unmount } = renderFit(100, 80)
  expect(observers).toHaveLength(1)
  expect(observers[0].disconnect).not.toHaveBeenCalled()

  unmount()
  expect(observers[0].disconnect).toHaveBeenCalledTimes(1)
})

it('re-measures when the observer fires after the column shrinks below the content', () => {
  const { getScale, resizeTo } = renderFit(100, 80)
  expect(getScale()).toBe(1)

  resizeTo(40, 80)
  expect(getScale()).toBeCloseTo(0.5)
})
