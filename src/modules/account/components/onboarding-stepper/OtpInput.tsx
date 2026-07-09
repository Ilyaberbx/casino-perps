import { useOtpInput } from './use-otp-input'
import type { OtpInputProps } from './otp-input.types'
import styles from './onboarding-stepper.module.css'

/**
 * Six segmented digit boxes (PRD-0006 UI-1 OTP step). Controlled: the parent
 * holds the `value`; this component renders boxes and routes auto-advance,
 * backspace-back, paste-fills-all, and auto-submit through `use-otp-input`.
 */
export function OtpInput(props: OtpInputProps) {
  const { disabled } = props
  const { digits, setRef, onDigitChange, onKeyDown, onPaste } = useOtpInput(props)

  return (
    <div className={styles.otpRow} onPaste={onPaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={setRef(index)}
          className={styles.otpBox}
          type="text"
          inputMode="numeric"
          aria-label={`Digit ${index + 1}`}
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => onDigitChange(index, e.target.value)}
          onKeyDown={(e) => onKeyDown(index, e)}
        />
      ))}
    </div>
  )
}
