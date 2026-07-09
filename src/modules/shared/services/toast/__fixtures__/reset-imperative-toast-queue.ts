import { imperativeToastQueue } from '../imperative-toast-queue'

export function resetImperativeToastQueue(): void {
  const drain = () => {}
  const unsubscribe = imperativeToastQueue.subscribe(drain)
  unsubscribe()
}
