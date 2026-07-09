import { describe, it, expect } from 'vitest'
import {
  bulkActionConfirmLabel,
  bulkActionPrompt,
  bulkActionTitle,
} from '../bulk-action.utils'

describe('bulk-action copy', () => {
  it('titles each action', () => {
    expect(bulkActionTitle('cancel-all')).toBe('Cancel all orders')
    expect(bulkActionTitle('close-all')).toBe('Close all positions')
  })

  it('labels the confirm button', () => {
    expect(bulkActionConfirmLabel('cancel-all')).toBe('Cancel all')
    expect(bulkActionConfirmLabel('close-all')).toBe('Close all')
  })

  it('pluralises the prompt by count', () => {
    expect(bulkActionPrompt('cancel-all', 1)).toContain('1 open order.')
    expect(bulkActionPrompt('cancel-all', 3)).toContain('3 open orders.')
    expect(bulkActionPrompt('close-all', 2)).toContain('2 positions.')
  })
})
