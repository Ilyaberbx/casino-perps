/** A CSS-module class map. Each consumer passes its own `*.module.css` import. */
export type FlowStyles = Record<string, string>

export interface FlowPercentChipsProps<P extends number> {
  readonly styles: FlowStyles
  readonly chips: ReadonlyArray<P>
  readonly disabled: boolean
  onPercent(percent: P): void
}
