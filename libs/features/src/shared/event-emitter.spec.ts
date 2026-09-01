import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createEventEmitter } from './event-emitter'

describe('createEventEmitter', () => {
  it('invokes a subscribed handler with the emitted payload', () => {
    const emitter = createEventEmitter()
    const handler = jest.fn()
    emitter.on('open', handler)
    emitter.emit('open', { ready: true })
    expect(handler).toHaveBeenCalledWith({ ready: true })
  })

  it('invokes every handler subscribed to the same event', () => {
    const emitter = createEventEmitter()
    const first = jest.fn()
    const second = jest.fn()
    emitter.on('msg', first)
    emitter.on('msg', second)
    emitter.emit('msg')
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('stops invoking a handler after its unsubscribe runs', () => {
    const emitter = createEventEmitter()
    const handler = jest.fn()
    const off = emitter.on('tick', handler)
    off()
    emitter.emit('tick')
    expect(handler).not.toHaveBeenCalled()
  })

  it('ignores emits for events that have no subscribers', () => {
    const emitter = createEventEmitter()
    expect(() => emitter.emit('unknown')).not.toThrow()
  })
})
