import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TwapRunningTime } from '../TwapRunningTime'

describe('TwapRunningTime', () => {
  it('renders the Hour and Minute fields', () => {
    render(
      <TwapRunningTime
        hoursInput="0"
        minutesInput="30"
        isValid
        onHoursChange={() => {}}
        onMinutesChange={() => {}}
      />,
    )
    expect(screen.getByLabelText('Running time hours')).toHaveValue('0')
    expect(screen.getByLabelText('Running time minutes')).toHaveValue('30')
  })

  it('uses the decimal input mode for both running-time fields', () => {
    render(
      <TwapRunningTime
        hoursInput="0"
        minutesInput="30"
        isValid
        onHoursChange={() => {}}
        onMinutesChange={() => {}}
      />,
    )
    expect(screen.getByLabelText('Running time hours')).toHaveAttribute('inputmode', 'decimal')
    expect(screen.getByLabelText('Running time minutes')).toHaveAttribute('inputmode', 'decimal')
  })

  it('forwards typed hours to onHoursChange', async () => {
    const onHoursChange = vi.fn()
    render(
      <TwapRunningTime
        hoursInput=""
        minutesInput="30"
        isValid
        onHoursChange={onHoursChange}
        onMinutesChange={() => {}}
      />,
    )
    await userEvent.type(screen.getByLabelText('Running time hours'), '2')
    expect(onHoursChange).toHaveBeenCalledWith('2')
  })

  it('forwards typed minutes to onMinutesChange', async () => {
    const onMinutesChange = vi.fn()
    render(
      <TwapRunningTime
        hoursInput="0"
        minutesInput=""
        isValid
        onHoursChange={() => {}}
        onMinutesChange={onMinutesChange}
      />,
    )
    await userEvent.type(screen.getByLabelText('Running time minutes'), '5')
    expect(onMinutesChange).toHaveBeenCalledWith('5')
  })

  it('marks both fields invalid when the running time is out of range', () => {
    render(
      <TwapRunningTime
        hoursInput="25"
        minutesInput="0"
        isValid={false}
        onHoursChange={() => {}}
        onMinutesChange={() => {}}
      />,
    )
    expect(screen.getByLabelText('Running time hours')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Running time minutes')).toHaveAttribute('aria-invalid', 'true')
  })

  it('leaves the fields valid when the running time is in range', () => {
    render(
      <TwapRunningTime
        hoursInput="0"
        minutesInput="30"
        isValid
        onHoursChange={() => {}}
        onMinutesChange={() => {}}
      />,
    )
    expect(screen.getByLabelText('Running time hours')).toHaveAttribute('aria-invalid', 'false')
  })
})
