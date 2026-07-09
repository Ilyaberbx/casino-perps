import { useCallback, useState } from 'react'
import type { UseFallbackImageParams, UseFallbackImageReturn } from './fallback-image.types'

/**
 * Owns the source-fallback state machine for `FallbackImage`. Renders
 * `sources[index]`; each `onError` advances the index. When the index runs
 * past the last source the image is exhausted and the consumer renders its
 * fallback node.
 *
 * Resets when the source URLs change — via React's adjust-state-during-render
 * pattern keyed on content, not array identity. The parent rebuilds `sources`
 * every render, so keying on the array reference (or an effect) would reset
 * the chain and re-hit the remote on every parent re-render.
 */
export function useFallbackImage({ sources }: UseFallbackImageParams): UseFallbackImageReturn {
  const sourcesKey = sources.join(' ')
  const [index, setIndex] = useState(0)
  const [prevKey, setPrevKey] = useState(sourcesKey)

  const sourcesChanged = prevKey !== sourcesKey
  if (sourcesChanged) {
    setPrevKey(sourcesKey)
    setIndex(0)
  }

  const onError = useCallback(() => {
    setIndex((current) => current + 1)
  }, [])

  const effectiveIndex = sourcesChanged ? 0 : index
  const isExhausted = effectiveIndex >= sources.length
  const currentSrc = isExhausted ? null : (sources[effectiveIndex] ?? null)

  return { currentSrc, isExhausted, onError }
}
