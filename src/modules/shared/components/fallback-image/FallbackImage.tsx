import { useFallbackImage } from './use-fallback-image'
import type { FallbackImageProps } from './fallback-image.types'

/**
 * Renders an image from an ordered list of sources, advancing to the next on a
 * load error and rendering `fallback` once all sources are exhausted. The
 * source-chain state lives in `useFallbackImage`; this component is render-only.
 */
export function FallbackImage(props: FallbackImageProps) {
  const { sources, alt, fallback, className, width, height } = props
  const { currentSrc, isExhausted, onError } = useFallbackImage({ sources })

  if (isExhausted || currentSrc === null) return <>{fallback}</>

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      width={width}
      height={height}
      onError={onError}
    />
  )
}
