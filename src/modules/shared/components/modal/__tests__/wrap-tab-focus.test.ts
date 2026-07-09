import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { wrapTabFocus } from '../modal.utils'

function mountDialog(html: string): HTMLElement {
  const dialog = document.createElement('div')
  dialog.innerHTML = html
  document.body.appendChild(dialog)
  return dialog
}

function tabEvent(shift: boolean): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, cancelable: true })
}

describe('wrapTabFocus', () => {
  let dialog: HTMLElement
  let first: HTMLButtonElement
  let last: HTMLButtonElement

  beforeEach(() => {
    dialog = mountDialog(`<button id="first">first</button><button id="last">last</button>`)
    first = dialog.querySelector<HTMLButtonElement>('#first')!
    last = dialog.querySelector<HTMLButtonElement>('#last')!
  })

  afterEach(() => {
    dialog.remove()
  })

  it('wraps Tab from the last focusable back to the first', () => {
    last.focus()
    const event = tabEvent(false)
    wrapTabFocus(dialog, event)
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)
  })

  it('wraps Shift+Tab from the first focusable to the last', () => {
    first.focus()
    const event = tabEvent(true)
    wrapTabFocus(dialog, event)
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)
  })

  it('does not wrap a forward Tab from the first focusable', () => {
    first.focus()
    const event = tabEvent(false)
    wrapTabFocus(dialog, event)
    expect(event.defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(first)
  })

  describe('includeOutsideActive divergence', () => {
    let outside: HTMLButtonElement

    beforeEach(() => {
      outside = document.createElement('button')
      document.body.appendChild(outside)
    })

    afterEach(() => {
      outside.remove()
    })

    it('wraps Shift+Tab to the last focusable when active is outside and option is true', () => {
      outside.focus()
      const event = tabEvent(true)
      wrapTabFocus(dialog, event, { includeOutsideActive: true })
      expect(event.defaultPrevented).toBe(true)
      expect(document.activeElement).toBe(last)
    })

    it('leaves outside focus alone on Shift+Tab when option is omitted', () => {
      outside.focus()
      const event = tabEvent(true)
      wrapTabFocus(dialog, event)
      expect(event.defaultPrevented).toBe(false)
      expect(document.activeElement).toBe(outside)
    })
  })
})
