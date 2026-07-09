import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OtpInput } from '../OtpInput'

describe('<OtpInput /> — segmented digit boxes', () => {
  function Harness({ onComplete }: { onComplete: (code: string) => void }) {
    const [value, setValue] = useState('')
    return <OtpInput value={value} onChange={setValue} onComplete={onComplete} disabled={false} />
  }

  it('renders six digit boxes', () => {
    render(<OtpInput value="" onChange={() => {}} onComplete={() => {}} disabled={false} />)
    expect(screen.getAllByLabelText(/digit/i)).toHaveLength(6)
  })

  it('auto-advances on type and calls onComplete when the 6th digit lands', async () => {
    const onComplete = vi.fn()
    const user = userEvent.setup()
    render(<Harness onComplete={onComplete} />)
    const boxes = screen.getAllByLabelText(/digit/i)
    await user.click(boxes[0])
    await user.keyboard('123456')
    expect(onComplete).toHaveBeenCalledWith('123456')
  })

  it('fills all six on a full-code paste and submits', async () => {
    const onComplete = vi.fn()
    const user = userEvent.setup()
    render(<Harness onComplete={onComplete} />)
    const boxes = screen.getAllByLabelText(/digit/i)
    await user.click(boxes[0])
    await user.paste('654321')
    expect(onComplete).toHaveBeenCalledWith('654321')
  })

  it('moves focus back on backspace in an empty box', async () => {
    const user = userEvent.setup()
    render(<OtpInput value="12" onChange={() => {}} onComplete={() => {}} disabled={false} />)
    const boxes = screen.getAllByLabelText(/digit/i) as HTMLInputElement[]
    await user.click(boxes[2])
    await user.keyboard('{Backspace}')
    expect(document.activeElement).toBe(boxes[1])
  })
})
