import { describe, expect, it } from '@hyperfrontend/testing'

describe('the DOM preload', () => {
  it('puts a document on the global', () => {
    expect(typeof document).toBe('object')
    expect(document.createElement('div').tagName).toBe('DIV')
  })

  it('makes window the global object, the way a browser does', () => {
    expect(globalThis.window).toBe(globalThis)
    expect(window.document).toBe(document)
  })

  it('keeps the realm intrinsics rather than the window copies', () => {
    expect([].constructor).toBe(Array)
  })
})
