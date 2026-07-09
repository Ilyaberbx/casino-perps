import styles from './pixel-slider.module.css'
import { pixelSliderStyle } from './pixel-slider.styles'
import { trackPercent } from './pixel-slider.utils'
import type { PixelSliderProps } from './pixel-slider.types'

const DEFAULT_STEP = 1
const DEFAULT_TONE = 'accent'

/**
 * Shared pixel-art range slider for the order ticket (leverage + Amount %).
 * A native `<input type="range">` carries interaction + a11y; a fill-progress
 * segment, hard square thumb, and tick notches are painted underneath via a
 * runtime CSS custom property (`pixel-slider.styles.ts`). Dumb — all state +
 * commit timing owned by the consumer. `onCommit` fires on pointer/key release
 * (the on-chain leverage action's commit-on-release timing); change-only
 * sliders (Amount %) omit it.
 */
export function PixelSlider({
  value,
  min,
  max,
  step = DEFAULT_STEP,
  ticks,
  tone = DEFAULT_TONE,
  ariaLabel,
  testId,
  disabled = false,
  onChange,
  onCommit,
}: PixelSliderProps) {
  const wrapperStyle = pixelSliderStyle(value, min, max, tone)
  const hasTicks = ticks !== undefined && ticks.length > 0
  const hasCaptions = hasTicks && ticks.some((tick) => tick.label !== undefined)

  return (
    <div className={styles.wrapper}>
      <div className={styles.track} style={wrapperStyle}>
        <div className={styles.rail} aria-hidden="true" />
        <div className={styles.fill} aria-hidden="true" />
        {hasTicks
          ? ticks.map((tick) => (
              <span
                key={tick.value}
                className={styles.notch}
                aria-hidden="true"
                style={{ left: trackPercent(tick.value, min, max) }}
              />
            ))
          : null}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          className={styles.input}
          aria-label={ariaLabel}
          data-testid={testId}
          onChange={(event) => onChange(Number(event.target.value))}
          onPointerUp={onCommit}
          onKeyUp={onCommit}
        />
      </div>
      {hasCaptions ? (
        <div className={styles.scale} aria-hidden="true">
          {ticks.map((tick) => (
            <span
              key={tick.value}
              className={styles.scaleLabel}
              style={{ left: trackPercent(tick.value, min, max) }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
