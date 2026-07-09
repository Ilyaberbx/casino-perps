import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AddressQr } from '../AddressQr'
import { encodeQrMatrix } from '../address-qr.utils'

const ADDRESS = '0xAbCdEf0000000000000000000000000000001234'

describe('encodeQrMatrix', () => {
  it('encodes a known address into a non-empty square matrix', () => {
    const result = encodeQrMatrix(ADDRESS)
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return

    const { count, cells } = result.value
    expect(count).toBeGreaterThan(0)
    expect(cells).toHaveLength(count)
    expect(cells[0]).toHaveLength(count)
    const hasDarkModule = cells.some((row) => row.some(Boolean))
    expect(hasDarkModule).toBe(true)
  })
})

describe('AddressQr', () => {
  it('renders an SVG with dark-module rects for the raw address', () => {
    render(<AddressQr value={ADDRESS} size={160} />)

    const svg = screen.getByRole('img', { name: /receive address qr code/i })
    expect(svg.querySelectorAll('rect').length).toBeGreaterThan(0)
  })
})
