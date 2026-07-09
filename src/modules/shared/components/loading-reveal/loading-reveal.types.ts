import type { ReactNode } from 'react'

export interface LoadingRevealProps {
  /** While true, the skeleton shows; on the true→false edge it crossfades out. */
  isLoading: boolean
  /** The loading placeholder (e.g. a `TableSkeleton`). */
  skeleton: ReactNode
  /** The loaded content (rows or an empty state), shown once loading ends. */
  children: ReactNode
}
