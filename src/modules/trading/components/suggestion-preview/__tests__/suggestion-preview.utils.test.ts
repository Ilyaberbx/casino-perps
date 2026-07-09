import { describe, it, expect } from 'vitest'
import type { OrderIssue } from '@/modules/shared/domain'
import { issueFor } from '../suggestion-preview.utils'

describe('issueFor', () => {
  it('returns the message of the issue tagged with the matching field', () => {
    const issues: readonly OrderIssue[] = [
      { field: 'size', message: 'Not enough margin' },
      { field: 'price', message: 'Price off tick' },
    ]
    expect(issueFor(issues, 'size')).toBe('Not enough margin')
    expect(issueFor(issues, 'price')).toBe('Price off tick')
  })

  it('returns null when no issue carries the requested field', () => {
    const issues: readonly OrderIssue[] = [{ field: 'price', message: 'Price off tick' }]
    expect(issueFor(issues, 'size')).toBeNull()
  })

  it('returns null for an empty issue list', () => {
    expect(issueFor([], 'size')).toBeNull()
  })

  it('ignores untagged issues when looking for a field', () => {
    const issues: readonly OrderIssue[] = [{ message: 'Generic problem' }]
    expect(issueFor(issues, 'size')).toBeNull()
  })

  it('returns the first matching issue when several share a field', () => {
    const issues: readonly OrderIssue[] = [
      { field: 'size', message: 'First' },
      { field: 'size', message: 'Second' },
    ]
    expect(issueFor(issues, 'size')).toBe('First')
  })
})
