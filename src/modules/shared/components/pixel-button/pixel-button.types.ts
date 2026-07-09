import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from 'react'

export type PixelButtonVariant =
  | 'default'
  | 'accent'
  | 'accentFilled'
  | 'directionUp'
  | 'directionDown'
export type PixelButtonSize = 'sm' | 'md'

interface PixelButtonCommonProps {
  variant?: PixelButtonVariant
  size?: PixelButtonSize
  fullWidth?: boolean
  /**
   * Swaps the single-layer black pixel shadow for the dual-layer black+teal
   * "patch" shadow (`--shadow-pixel-md`/`-lg`), so the button reads 3D against
   * the dark background like the surrounding tiles/cards. Opt-in: buttons that
   * don't pass it render identically to before.
   */
  elevated?: boolean
  children: ReactNode
}

export type PixelButtonProps =
  | (PixelButtonCommonProps & { as?: 'button'; ref?: Ref<HTMLButtonElement> } & ButtonHTMLAttributes<HTMLButtonElement>)
  | (PixelButtonCommonProps & { as: 'a'; ref?: Ref<HTMLAnchorElement> } & AnchorHTMLAttributes<HTMLAnchorElement>)
