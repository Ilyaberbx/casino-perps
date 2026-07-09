/**
 * jsdom does not implement `HTMLDialogElement` open methods, which the shared
 * `Sheet` relies on (`show` / `close`). Mirror the minimal polyfill the shared
 * `Sheet` test uses so the AI sheet can mount in jsdom. Idempotent.
 */
type DialogProto = HTMLDialogElement & {
  show(): void
  showModal(): void
  close(): void
  open: boolean
}

export function installDialogPolyfill(): void {
  const proto = HTMLDialogElement.prototype as DialogProto
  const marker = proto.show as unknown as { __polyfilled?: boolean } | undefined
  if (marker && marker.__polyfilled) return

  const open = function open(this: HTMLDialogElement): void {
    this.setAttribute('open', '')
    Object.defineProperty(this, 'open', { configurable: true, value: true })
  }
  ;(open as unknown as { __polyfilled: boolean }).__polyfilled = true
  proto.show = open
  proto.showModal = open
  proto.close = function close(this: HTMLDialogElement): void {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    Object.defineProperty(this, 'open', { configurable: true, value: false })
    this.dispatchEvent(new Event('close'))
  }
}
