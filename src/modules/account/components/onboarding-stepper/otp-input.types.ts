import type { ClipboardEvent, KeyboardEvent } from 'react'

export const OTP_LENGTH = 6

export interface OtpInputProps {
  value: string
  onChange: (next: string) => void
  onComplete: (code: string) => void
  disabled: boolean
}

export interface UseOtpInputReturn {
  digits: string[]
  setRef: (index: number) => (el: HTMLInputElement | null) => void
  onDigitChange: (index: number, raw: string) => void
  onKeyDown: (index: number, event: KeyboardEvent<HTMLInputElement>) => void
  onPaste: (event: ClipboardEvent<HTMLInputElement>) => void
}
