import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { installDom } from './dom'

// why: the module installs a DOM as it loads, so every assertion below is about the global this file already has.

describe('the DOM environment', () => {
  it('puts a document on the global', () => {
    assert.equal(typeof document, 'object')
  })

  it('serves the constructors a browser spec builds elements with', () => {
    assert.equal(document.createElement('div') instanceof HTMLElement, true)
  })

  it('dispatches an event to a listener', () => {
    let received = 0
    document.addEventListener('probe', () => (received += 1))
    document.dispatchEvent(new Event('probe'))
    assert.equal(received, 1)
  })

  it('keeps the intrinsics of this realm rather than the window own', () => {
    assert.equal([].constructor, Array)
    assert.equal(document.createElement('div').constructor === HTMLElement, false)
  })

  it('keeps Node timers, which are what the fake clock replaces', () => {
    assert.equal(typeof setTimeout(() => undefined, 0), 'object')
  })

  it('keeps Node WebCrypto, which implements subtle', () => {
    assert.equal(typeof globalThis.crypto.subtle, 'object')
  })

  it('keeps the URL class node:url recognises', () => {
    assert.equal(new URL('file:///a/b').protocol, 'file:')
  })

  it('keeps the base64 helpers, whose jsdom versions would call the copy of themselves', () => {
    assert.equal(btoa('Hello, World!'), 'SGVsbG8sIFdvcmxkIQ==')
    assert.equal(atob('SGVsbG8sIFdvcmxkIQ=='), 'Hello, World!')
  })

  it('lets a spec redefine a navigator property', () => {
    Object.defineProperty(navigator, 'userAgent', { value: 'probe', configurable: true, writable: true })
    assert.equal(navigator.userAgent, 'probe')
  })

  it('can be installed again over an existing DOM', () => {
    const before = document
    installDom()
    assert.notEqual(document, before)
  })
})
