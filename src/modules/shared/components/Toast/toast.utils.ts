import type { ToastVariant } from '@/modules/shared/services/toast'

export function variantIconGlyph(variant: ToastVariant): string {
  switch (variant) {
    case 'success':
      return '✓'
    case 'error':
      return '!'
    case 'warning':
      return '▲'
    case 'info':
      return 'i'
  }
}

export function ariaLiveForVariant(variant: ToastVariant): 'polite' | 'assertive' {
  const isAssertive = variant === 'error'
  return isAssertive ? 'assertive' : 'polite'
}
