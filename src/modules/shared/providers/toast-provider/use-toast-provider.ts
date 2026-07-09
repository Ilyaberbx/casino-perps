import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TOAST_EXIT_MS } from '@/modules/shared/components/Toast'
import {
  imperativeToastQueue,
  buildToastRecord,
  TOAST_STACK_CAP,
  type ToastApi,
  type ToastPayload,
  type ToastQueueEvent,
  type ToastRecord,
} from '@/modules/shared/services/toast'

interface UseToastProviderReturn {
  readonly toasts: ReadonlyArray<ToastRecord>
  readonly exitingIds: ReadonlySet<string>
  readonly api: ToastApi
  readonly dismiss: (id: string) => void
}

function replaceOrAppend(
  current: ReadonlyArray<ToastRecord>,
  record: ToastRecord,
): ToastRecord[] {
  const existingIndex = current.findIndex((entry) => entry.id === record.id)
  const isDuplicate = existingIndex !== -1
  if (isDuplicate) {
    const next = [...current]
    next[existingIndex] = record
    return next
  }
  const appended = [...current, record]
  const isOverCap = appended.length > TOAST_STACK_CAP
  if (!isOverCap) return appended
  return appended.slice(appended.length - TOAST_STACK_CAP)
}

function withoutId(current: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const isTracked = current.has(id)
  if (!isTracked) return current
  const next = new Set(current)
  next.delete(id)
  return next
}

export function useToastProvider(): UseToastProviderReturn {
  const [toasts, setToasts] = useState<ReadonlyArray<ToastRecord>>([])
  const [exitingIds, setExitingIds] = useState<ReadonlySet<string>>(() => new Set())
  // Two phases, two timer maps: auto-dismiss countdown vs. the post-exit unmount
  // window. A toast is in at most one map at a time (auto → exit), so keying both
  // by id stays unambiguous.
  const autoTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const exitTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const clearAutoTimer = useCallback((id: string) => {
    const timer = autoTimersRef.current.get(id)
    const hasTimer = timer !== undefined
    if (!hasTimer) return
    clearTimeout(timer)
    autoTimersRef.current.delete(id)
  }, [])

  const clearAllTimers = useCallback(() => {
    for (const timer of autoTimersRef.current.values()) clearTimeout(timer)
    for (const timer of exitTimersRef.current.values()) clearTimeout(timer)
    autoTimersRef.current.clear()
    exitTimersRef.current.clear()
  }, [])

  const removeToast = useCallback((id: string) => {
    exitTimersRef.current.delete(id)
    setToasts((current) => current.filter((entry) => entry.id !== id))
    setExitingIds((current) => withoutId(current, id))
  }, [])

  // Cancel a pending exit so a re-shown toast (same id) comes back to life.
  const cancelExit = useCallback((id: string) => {
    const timer = exitTimersRef.current.get(id)
    const hasTimer = timer !== undefined
    if (!hasTimer) return
    clearTimeout(timer)
    exitTimersRef.current.delete(id)
    setExitingIds((current) => withoutId(current, id))
  }, [])

  const dismiss = useCallback(
    (id: string) => {
      clearAutoTimer(id)
      const isAlreadyExiting = exitTimersRef.current.has(id)
      if (isAlreadyExiting) return
      setExitingIds((current) => new Set(current).add(id))
      const timer = setTimeout(() => removeToast(id), TOAST_EXIT_MS)
      exitTimersRef.current.set(id, timer)
    },
    [clearAutoTimer, removeToast],
  )

  const scheduleAutoDismiss = useCallback(
    (record: ToastRecord) => {
      clearAutoTimer(record.id)
      const isInfinite = !Number.isFinite(record.durationMs)
      if (isInfinite) return
      const timer = setTimeout(() => dismiss(record.id), record.durationMs)
      autoTimersRef.current.set(record.id, timer)
    },
    [clearAutoTimer, dismiss],
  )

  const showRecord = useCallback(
    (record: ToastRecord) => {
      cancelExit(record.id)
      setToasts((current) => replaceOrAppend(current, record))
      scheduleAutoDismiss(record)
    },
    [cancelExit, scheduleAutoDismiss],
  )

  const reset = useCallback(() => {
    clearAllTimers()
    setExitingIds(new Set())
    setToasts([])
  }, [clearAllTimers])

  useEffect(() => {
    const unsubscribe = imperativeToastQueue.subscribe((event: ToastQueueEvent) => {
      if (event.kind === 'show') {
        showRecord(event.record)
        return
      }
      if (event.kind === 'dismiss') {
        dismiss(event.id)
        return
      }
      reset()
    })
    return () => {
      unsubscribe()
      clearAllTimers()
    }
  }, [dismiss, showRecord, reset, clearAllTimers])

  const api = useMemo<ToastApi>(
    () => ({
      show(payload: ToastPayload): string {
        const record = buildToastRecord(payload, Date.now())
        showRecord(record)
        return record.id
      },
      dismiss,
      dismissAll(): void {
        reset()
      },
    }),
    [dismiss, showRecord, reset],
  )

  return { toasts, exitingIds, api, dismiss }
}
