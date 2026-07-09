import { describe, it, expect } from 'vitest'
import { getFocusableElements } from '../modal.utils'

function container(html: string): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

describe('getFocusableElements', () => {
  it('collects buttons, links, inputs and [tabindex] in DOM order', () => {
    const el = container(`
      <a href="#">link</a>
      <button>btn</button>
      <input />
      <div tabindex="0">div</div>
    `)
    const labels = getFocusableElements(el).map((n) => n.tagName.toLowerCase())
    expect(labels).toEqual(['a', 'button', 'input', 'div'])
  })

  it('excludes disabled controls', () => {
    const el = container(`<button disabled>off</button><button>on</button>`)
    const focusable = getFocusableElements(el)
    expect(focusable).toHaveLength(1)
    expect(focusable[0].textContent).toBe('on')
  })

  it('excludes tabindex="-1" and hidden nodes', () => {
    const el = container(`<button tabindex="-1">skip</button><button hidden>hidden</button><button>keep</button>`)
    const focusable = getFocusableElements(el)
    expect(focusable).toHaveLength(1)
    expect(focusable[0].textContent).toBe('keep')
  })
})
