import type { CSSProperties } from 'react'
import styles from './fit-cell.module.css'
import { useFitCell } from './use-fit-cell'
import type { FitCellProps } from './fit-cell.types'

/**
 * Single-line table cell that horizontally compresses its content with
 * `transform: scaleX(...)` when it would overflow the column, so every
 * character stays visible on one line (precision preserved). Dumb component —
 * all measurement lives in `useFitCell`.
 */
export function FitCell({ children, align = 'right', className, title }: FitCellProps) {
  const { outerRef, innerRef, scaleX } = useFitCell()

  const alignClass = align === 'right' ? styles.alignRight : styles.alignLeft
  const innerClass = `${styles.inner} ${alignClass}`
  const outerClass = className === undefined ? styles.outer : `${styles.outer} ${className}`
  const innerStyle = { '--fit-scale': scaleX } as CSSProperties

  return (
    <span ref={outerRef} className={outerClass} title={title}>
      <span ref={innerRef} className={innerClass} style={innerStyle} data-fit-align={align}>
        {children}
      </span>
    </span>
  )
}
