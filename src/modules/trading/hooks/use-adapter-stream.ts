import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import type { UseAdapterStreamArgs } from './use-adapter-stream.types'

export function useAdapterStream<TEvent, TState>(
  args: UseAdapterStreamArgs<TEvent, TState>,
): TState {
  const { subscribe: externalSubscribe } = args

  const stateRef = useRef<TState>(args.initial)
  const initialRef = useRef(args.initial)
  const reducerRef = useRef(args.reducer)
  const resetOnSubscribeRef = useRef(args.resetOnSubscribe === true)
  const listenersRef = useRef<Set<() => void>>(new Set())

  useEffect(() => {
    reducerRef.current = args.reducer
    resetOnSubscribeRef.current = args.resetOnSubscribe === true
  })

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      listenersRef.current.add(onStoreChange)
      if (resetOnSubscribeRef.current) {
        stateRef.current = initialRef.current
      }

      // Coalesce store notifications to one per animation frame (ADR-0043). The
      // reducer still runs synchronously on EVERY event, so `stateRef` always
      // holds the latest fully-accumulated state — no dropped trades, no stale
      // book. Only the React notification is throttled: a burst of websocket
      // messages between two frames collapses into a single re-render reading the
      // newest snapshot. This caps every high-frequency stream (orderbook, trades,
      // ticker) to the display refresh rate and is the primary fix for the
      // streaming-render jank that tanked FPS on active markets.
      let frameHandle = 0
      const notifyListeners = () => {
        frameHandle = 0
        for (const listener of listenersRef.current) {
          listener()
        }
      }
      const scheduleNotify = () => {
        if (frameHandle !== 0) return
        frameHandle = requestAnimationFrame(notifyListeners)
      }

      const unsubscribeFromSource = externalSubscribe((event) => {
        stateRef.current = reducerRef.current(stateRef.current, event)
        scheduleNotify()
      })
      return () => {
        listenersRef.current.delete(onStoreChange)
        if (frameHandle !== 0) cancelAnimationFrame(frameHandle)
        unsubscribeFromSource()
      }
    },
    [externalSubscribe],
  )

  const getSnapshot = useCallback(() => stateRef.current, [])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
