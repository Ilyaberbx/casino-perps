import type { ReactNode } from 'react'

export interface FallbackImageProps {
  /**
   * Ordered list of image URLs to try, most-preferred first. The component
   * renders the first source; on a load error it advances to the next. When
   * every source has errored, `fallback` is rendered instead.
   */
  sources: ReadonlyArray<string>
  alt: string
  fallback: ReactNode
  className?: string
  width?: number
  height?: number
}

export interface UseFallbackImageParams {
  sources: ReadonlyArray<string>
}

export interface UseFallbackImageReturn {
  /** Current source URL to render, or `null` when all sources are exhausted. */
  currentSrc: string | null
  /** True once every source has errored — render the fallback node. */
  isExhausted: boolean
  onError: () => void
}
