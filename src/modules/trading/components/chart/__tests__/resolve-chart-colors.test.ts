import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resolveChartColors } from '../chart.utils'

describe('resolveChartColors', () => {
  const originalGetComputedStyle = window.getComputedStyle

  beforeEach(() => {
    const stub = vi.fn().mockImplementation(() => ({
      getPropertyValue: (name: string) => {
        const map: Record<string, string> = {
          '--background': '#0a0d14',
          '--surface': '#11151f',
          '--border': '#1f2533',
          '--border-strong': '#2a3142',
          '--text': '#e6e8ef',
          '--textMuted': '#6b7280',
          '--directionUp': '#10b981',
          '--directionDown': '#f43f5e',
          '--font-mono': "'General Sans', system-ui, sans-serif",
        }
        return map[name] ?? ''
      },
    }))
    window.getComputedStyle = stub as unknown as typeof window.getComputedStyle
  })

  afterEach(() => {
    window.getComputedStyle = originalGetComputedStyle
  })

  it('returns the locked palette for the dark theme via CSS vars', () => {
    const colors = resolveChartColors('dark')
    expect(colors.background).toBe('#0a0d14')
    expect(colors.surface).toBe('#11151f')
    expect(colors.border).toBe('#1f2533')
    expect(colors.borderStrong).toBe('#2a3142')
    expect(colors.text).toBe('#e6e8ef')
    expect(colors.textMuted).toBe('#6b7280')
    expect(colors.directionUp).toBe('#10b981')
    expect(colors.directionDown).toBe('#f43f5e')
    expect(colors.fontMono).toContain('General Sans')
  })

  it('trims leading/trailing whitespace returned by getPropertyValue', () => {
    window.getComputedStyle = vi.fn().mockImplementation(() => ({
      getPropertyValue: () => '   #112233  ',
    })) as unknown as typeof window.getComputedStyle
    const colors = resolveChartColors('dark')
    expect(colors.background).toBe('#112233')
  })
})
