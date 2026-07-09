import type { BulkActionKind } from './account-dock.types'

export function bulkActionTitle(action: BulkActionKind): string {
  return action === 'cancel-all' ? 'Cancel all orders' : 'Close all positions'
}

export function bulkActionConfirmLabel(action: BulkActionKind): string {
  return action === 'cancel-all' ? 'Cancel all' : 'Close all'
}

export function bulkActionPrompt(action: BulkActionKind, count: number): string {
  const noun = action === 'cancel-all' ? 'open order' : 'position'
  const plural = count === 1 ? noun : `${noun}s`
  const verb = action === 'cancel-all' ? 'cancel' : 'close'
  return `This will ${verb} ${count} ${plural}. This cannot be undone.`
}
