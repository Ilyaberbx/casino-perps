export interface UseAdapterStreamArgs<TEvent, TState> {
  initial: TState
  subscribe: (onEvent: (event: TEvent) => void) => () => void
  reducer: (previous: TState, event: TEvent) => TState
  resetOnSubscribe?: boolean
}
