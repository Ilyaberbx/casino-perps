import type { ToastQueueEvent, ToastQueueListener } from './toast.types'

interface ImperativeToastQueue {
  enqueue(event: ToastQueueEvent): void
  subscribe(listener: ToastQueueListener): () => void
}

function createImperativeToastQueue(): ImperativeToastQueue {
  let listener: ToastQueueListener | null = null
  const pending: ToastQueueEvent[] = []

  return {
    enqueue(event) {
      if (listener === null) {
        pending.push(event)
        return
      }
      listener(event)
    },
    subscribe(next) {
      listener = next
      const drained = pending.splice(0, pending.length)
      for (const event of drained) {
        next(event)
      }
      return () => {
        const isStillCurrent = listener === next
        if (!isStillCurrent) return
        listener = null
      }
    },
  }
}

export const imperativeToastQueue = createImperativeToastQueue()
