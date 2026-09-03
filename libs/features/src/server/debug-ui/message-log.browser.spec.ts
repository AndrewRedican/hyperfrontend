import { describe, expect, it } from '@hyperfrontend/testing'
import { createMessageLog } from './message-log'

describe('createMessageLog', () => {
  it('appends a message to the log', () => {
    const log = createMessageLog()
    log.append({ direction: 'incoming', raw: { type: 'tick' } })
    expect(log.element.textContent).toEqual(expect.stringContaining('"type"'))
  })

  it('labels an incoming message', () => {
    const log = createMessageLog()
    log.append({ direction: 'incoming', raw: {} })
    expect(log.element.textContent).toEqual(expect.stringContaining('◀ in'))
  })

  it('labels an outgoing message and its channel', () => {
    const log = createMessageLog()
    log.append({ direction: 'outgoing', raw: {}, channel: 'clock' })
    expect(log.element.textContent).toEqual(expect.stringContaining('▶ out · clock'))
  })

  it('shows the raw payload under the raw view', () => {
    const log = createMessageLog()
    log.append({ direction: 'incoming', raw: { a: 1 }, decrypted: { b: 2 } })
    log.setView('raw')
    expect(log.element.textContent).toEqual(expect.stringContaining('{"a":1}'))
  })

  it('shows the decrypted payload under the decrypted view', () => {
    const log = createMessageLog()
    log.append({ direction: 'incoming', raw: { a: 1 }, decrypted: { b: 2 } })
    log.setView('decrypted')
    expect(log.element.textContent).toEqual(expect.stringContaining('{"b":2}'))
  })

  it('notes the missing plaintext when no decrypted payload exists', () => {
    const log = createMessageLog()
    log.append({ direction: 'incoming', raw: { a: 1 } })
    log.setView('decrypted')
    expect(log.element.textContent).toEqual(expect.stringContaining('no decrypted payload'))
  })

  it('indents the payload under the pretty view', () => {
    const log = createMessageLog()
    log.append({ direction: 'incoming', raw: { a: 1 } })
    log.setView('pretty')
    expect(log.element.textContent).toEqual(expect.stringContaining('{\n  "a": 1\n}'))
  })

  it('switches view when a toolbar button is clicked', () => {
    const log = createMessageLog()
    log.append({ direction: 'incoming', raw: { a: 1 } })
    const rawButton = [...log.element.querySelectorAll('button')].find((b) => b.textContent === 'raw')
    rawButton?.click()
    expect(log.element.textContent).toEqual(expect.stringContaining('{"a":1}'))
  })

  it('clears every logged message', () => {
    const log = createMessageLog()
    log.append({ direction: 'incoming', raw: { a: 1 } })
    log.clear()
    expect(log.element.textContent).not.toEqual(expect.stringContaining('"a"'))
  })
})
