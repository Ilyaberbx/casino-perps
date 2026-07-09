import '@testing-library/jest-dom'

class FakeStorage implements Storage {
  private store: Record<string, string> = {}

  get length(): number {
    return Object.keys(this.store).length
  }

  clear(): void {
    this.store = {}
  }

  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value)
  }

  removeItem(key: string): void {
    delete this.store[key]
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null
  }
}

Object.defineProperty(window, 'localStorage', {
  value: new FakeStorage(),
  writable: true,
})

// jsdom lacks ResizeObserver — @tanstack/react-virtual measures the scroll
// element via it; without a polyfill the virtualizer reports zero visible
// items in tests. The mock invokes the observer callback once with a
// canned 1000×600 rect when `observe()` is called, which is enough for
// the virtualizer to surface rows in tests.
if (typeof globalThis.ResizeObserver === 'undefined') {
  type ResizeObserverCallback = (
    entries: readonly { target: Element; contentRect: DOMRectReadOnly }[],
    observer: ResizeObserver,
  ) => void
  class MockResizeObserver implements ResizeObserver {
    private readonly callback: ResizeObserverCallback
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }
    observe(target: Element): void {
      const rect = {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 1000,
        bottom: 600,
        width: 1000,
        height: 600,
        toJSON: () => ({}),
      } as DOMRectReadOnly
      this.callback([{ target, contentRect: rect }], this)
    }
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
}

// jsdom returns a zero-sized rect for every element. Override to a sane
// default so the virtualizer's first measurement sees a non-empty scroll
// container.
if (typeof Element !== 'undefined') {
  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
    const native = originalGetBoundingClientRect.call(this)
    const isZeroSized = native.width === 0 && native.height === 0
    if (!isZeroSized) return native
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 600,
      width: 1000,
      height: 600,
      toJSON: () => ({}),
    } as DOMRect
  }
}

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}
