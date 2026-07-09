export interface FakeMediaQueryList {
  matches: boolean
  media: string
  addEventListener: (type: 'change', listener: (event: MediaQueryListEvent) => void) => void
  removeEventListener: (type: 'change', listener: (event: MediaQueryListEvent) => void) => void
  dispatch: (matches: boolean) => void
}
