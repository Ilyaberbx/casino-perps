import styles from './pixel-button.module.css'
import type { PixelButtonProps, PixelButtonSize, PixelButtonVariant } from './pixel-button.types'

const variantClass: Record<PixelButtonVariant, string> = {
  default: styles.variantDefault,
  accent: styles.variantAccent,
  accentFilled: styles.variantAccentFilled,
  directionUp: styles.variantDirectionUp,
  directionDown: styles.variantDirectionDown,
}

const sizeClass: Record<PixelButtonSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
}

export function PixelButton(props: PixelButtonProps) {
  const {
    variant = 'default',
    size = 'md',
    fullWidth = false,
    elevated = false,
    children,
    as = 'button',
    className,
    ref,
    ...rest
  } = props as PixelButtonProps & {
    className?: string
    as?: 'button' | 'a'
    ref?: React.Ref<HTMLButtonElement & HTMLAnchorElement>
  }

  const content = children

  const composed = [
    styles.button,
    variantClass[variant],
    sizeClass[size],
    fullWidth ? styles.fullWidth : null,
    elevated ? styles.elevated : null,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  if (as === 'a') {
    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        className={composed}
        {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {content}
      </a>
    )
  }

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      className={composed}
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {content}
    </button>
  )
}
