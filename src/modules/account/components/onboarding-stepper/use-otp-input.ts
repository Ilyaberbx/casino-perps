import { useCallback, useRef } from 'react'
import type { ClipboardEvent, KeyboardEvent } from 'react'
import { OTP_LENGTH, type OtpInputProps, type UseOtpInputReturn } from './otp-input.types'

function toDigits(value: string): string[] {
  const clean = value.replace(/\D/g, '').slice(0, OTP_LENGTH)
  return Array.from({ length: OTP_LENGTH }, (_, i) => clean[i] ?? '')
}

export function useOtpInput({ value, onChange, onComplete }: OtpInputProps): UseOtpInputReturn {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const digits = toDigits(value)

  const focusBox = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(OTP_LENGTH - 1, index))
    refs.current[clamped]?.focus()
  }, [])

  const emit = useCallback(
    (next: string) => {
      onChange(next)
      const isComplete = next.length === OTP_LENGTH
      if (isComplete) onComplete(next)
    },
    [onChange, onComplete],
  )

  const setRef = useCallback(
    (index: number) => (el: HTMLInputElement | null) => {
      refs.current[index] = el
    },
    [],
  )

  const onDigitChange = useCallback(
    (index: number, raw: string) => {
      const digit = raw.replace(/\D/g, '').slice(-1)
      if (digit === '') return
      const chars = toDigits(value)
      chars[index] = digit
      focusBox(index + 1)
      emit(chars.join(''))
    },
    [value, focusBox, emit],
  )

  const onKeyDown = useCallback(
    (index: number, event: KeyboardEvent<HTMLInputElement>) => {
      const isBackspace = event.key === 'Backspace'
      if (!isBackspace) return
      const chars = toDigits(value)
      const isCurrentEmpty = chars[index] === ''
      if (isCurrentEmpty) {
        focusBox(index - 1)
        return
      }
      chars[index] = ''
      emit(chars.join(''))
    },
    [value, focusBox, emit],
  )

  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement>) => {
      event.preventDefault()
      const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
      if (pasted === '') return
      focusBox(pasted.length - 1)
      emit(pasted)
    },
    [focusBox, emit],
  )

  return { digits, setRef, onDigitChange, onKeyDown, onPaste }
}
