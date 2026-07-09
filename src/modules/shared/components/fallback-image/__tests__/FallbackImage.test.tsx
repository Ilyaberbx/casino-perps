import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FallbackImage } from '../FallbackImage'

describe('<FallbackImage />', () => {
  it('renders the first source', () => {
    render(
      <FallbackImage sources={['a.png', 'b.png']} alt="venue" fallback={<span>FB</span>} />,
    )
    expect(screen.getByRole('img', { name: 'venue' })).toHaveAttribute('src', 'a.png')
  })

  it('falls back to the next source on error', () => {
    render(
      <FallbackImage sources={['a.png', 'b.png']} alt="venue" fallback={<span>FB</span>} />,
    )
    fireEvent.error(screen.getByRole('img', { name: 'venue' }))
    expect(screen.getByRole('img', { name: 'venue' })).toHaveAttribute('src', 'b.png')
  })

  it('renders the fallback node once all sources error', () => {
    render(
      <FallbackImage sources={['a.png']} alt="venue" fallback={<span>FB</span>} />,
    )
    fireEvent.error(screen.getByRole('img', { name: 'venue' }))
    expect(screen.getByText('FB')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'venue' })).not.toBeInTheDocument()
  })

  it('renders the fallback node immediately for an empty source list', () => {
    render(<FallbackImage sources={[]} alt="venue" fallback={<span>FB</span>} />)
    expect(screen.getByText('FB')).toBeInTheDocument()
  })
})
