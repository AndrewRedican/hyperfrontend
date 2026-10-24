import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { advanceTimersByTime, useFakeTimers, useRealTimers } from '../mock/timers'
import { createFakeWindow, createWindowPair } from './window'

/**
 * Collects the message events a window's listener receives.
 *
 * @param target - The window to listen on.
 * @returns The received events, filled in as they arrive.
 */
function listen(target: Window): MessageEvent[] {
  const received: MessageEvent[] = []
  target.addEventListener('message', (event) => received.push(event as MessageEvent))
  return received
}

describe('createFakeWindow', () => {
  it('reports the origin it was given', () => {
    assert.equal(createFakeWindow({ origin: 'https://host.test' }).origin, 'https://host.test')
  })

  it('defaults to a localhost origin, on the window and its location', () => {
    const fake = createFakeWindow()
    assert.deepEqual({ origin: fake.origin, location: fake.location.origin }, { origin: 'http://localhost', location: 'http://localhost' })
  })

  it('records posted messages without delivering them', () => {
    const fake = createFakeWindow()
    const received = listen(fake)
    fake.postMessage({ type: 'PING' }, '*')
    assert.deepEqual({ posted: fake.posted(), delivered: received.length }, { posted: [{ type: 'PING' }], delivered: 0 })
  })

  it('dispatches a received message with the sender it was given', () => {
    const fake = createFakeWindow()
    const source = createFakeWindow()
    const received = listen(fake)
    fake.receive('hello', { origin: 'https://feature.test', source })
    const [event] = received
    assert.deepEqual(
      { data: event?.data, origin: event?.origin, source: event?.source === source },
      { data: 'hello', origin: 'https://feature.test', source: true }
    )
  })

  it('dispatches a received message from its own origin and no source by default', () => {
    const fake = createFakeWindow({ origin: 'https://self.test' })
    const received = listen(fake)
    fake.receive('hello')
    assert.deepEqual({ origin: received[0]?.origin, source: received[0]?.source }, { origin: 'https://self.test', source: null })
  })

  it('calls a listener object through handleEvent', () => {
    const fake = createFakeWindow()
    const seen: unknown[] = []
    fake.addEventListener('message', { handleEvent: (event: Event) => seen.push((event as MessageEvent).data) })
    fake.receive(1)
    assert.deepEqual(seen, [1])
  })

  it('calls a function listener with the window as this', () => {
    const fake = createFakeWindow()
    const receivers: unknown[] = []
    fake.addEventListener('message', function (this: unknown) {
      receivers.push(this)
    })
    fake.receive(1)
    assert.deepEqual(receivers, [fake])
  })

  it('registers the same listener once', () => {
    const fake = createFakeWindow()
    const listener = (): void => undefined
    fake.addEventListener('message', listener)
    fake.addEventListener('message', listener)
    assert.equal(fake.messageListenerCount(), 1)
  })

  it('ignores listeners for other event types and null listeners', () => {
    const fake = createFakeWindow()
    fake.addEventListener('resize', () => undefined)
    fake.addEventListener('message', null)
    assert.equal(fake.messageListenerCount(), 0)
  })

  it('drops a once listener after its first call', () => {
    const fake = createFakeWindow()
    const seen: unknown[] = []
    fake.addEventListener('message', (event: Event) => seen.push((event as MessageEvent).data), { once: true })
    fake.receive(1)
    fake.receive(2)
    assert.deepEqual(seen, [1])
  })

  it('removes a listener', () => {
    const fake = createFakeWindow()
    const listener = (): void => undefined
    fake.addEventListener('message', listener)
    fake.removeEventListener('message', listener)
    assert.equal(fake.messageListenerCount(), 0)
  })

  it('ignores removal of a listener it does not hold', () => {
    const fake = createFakeWindow()
    fake.addEventListener('message', () => undefined)
    fake.removeEventListener('message', () => undefined)
    assert.equal(fake.messageListenerCount(), 1)
  })
})

describe('createWindowPair', () => {
  afterEach(() => useRealTimers())

  it('delivers a post to the window posted to, from the other window and its origin', async () => {
    const [host, frame] = createWindowPair({ origins: ['https://host.test', 'https://frame.test'] })
    const received = listen(frame)
    frame.postMessage({ type: 'PING' }, 'https://frame.test')
    await new Promise((resolve) => setTimeout(resolve, 0))
    const [event] = received
    assert.deepEqual(
      { data: event?.data, origin: event?.origin, source: event?.source === host },
      { data: { type: 'PING' }, origin: 'https://host.test', source: true }
    )
  })

  it('waits for a later task before delivering', () => {
    const [, b] = createWindowPair()
    const received = listen(b)
    b.postMessage('later', '*')
    assert.equal(received.length, 0)
  })

  it('delivers on a timer task that fake timers control', () => {
    useFakeTimers()
    const [, b] = createWindowPair()
    const received = listen(b)
    b.postMessage('later', '*')
    // magic: a zero delay is raised to one millisecond, as the real schedulers raise it.
    advanceTimersByTime(1)
    assert.equal(received.length, 1)
  })

  it('delivers inside the call when asked to deliver synchronously', () => {
    const [a] = createWindowPair({ delivery: 'sync' })
    const received = listen(a)
    a.postMessage('now', '*')
    assert.equal(received[0]?.data, 'now')
  })

  it('uses the default origins when none are given', () => {
    const [a, b] = createWindowPair()
    assert.deepEqual([a.origin, b.origin], ['http://a.test', 'http://b.test'])
  })

  it('drops a post whose target origin is not the receiving window', () => {
    const [, b] = createWindowPair({ delivery: 'sync' })
    const received = listen(b)
    b.postMessage('lost', 'https://elsewhere.test')
    assert.deepEqual({ recorded: b.posted(), delivered: received.length }, { recorded: ['lost'], delivered: 0 })
  })

  it('reads the target origin from an options object', () => {
    const [, b] = createWindowPair({ delivery: 'sync' })
    const received = listen(b)
    b.postMessage('kept', { targetOrigin: 'http://b.test' })
    assert.equal(received.length, 1)
  })

  it('treats a missing target origin as any origin', () => {
    const [, b] = createWindowPair({ delivery: 'sync' })
    const received = listen(b)
    ;(b.postMessage as (data: unknown) => void)('kept')
    assert.equal(received.length, 1)
  })

  it('treats / as the sender origin, dropping a post to another origin', () => {
    const [, b] = createWindowPair({ delivery: 'sync' })
    const received = listen(b)
    b.postMessage('lost', '/')
    assert.equal(received.length, 0)
  })

  it('treats / as the sender origin, delivering a post within one origin', () => {
    const [, b] = createWindowPair({ origins: ['https://same.test', 'https://same.test'], delivery: 'sync' })
    const received = listen(b)
    b.postMessage('kept', '/')
    assert.equal(received.length, 1)
  })

  it('delivers a copy, never the object the sender posted', () => {
    const [, b] = createWindowPair({ delivery: 'sync' })
    const received = listen(b)
    const message = { count: 1 }
    b.postMessage(message, '*')
    message.count = 2
    assert.deepEqual(received[0]?.data, { count: 1 })
  })

  it('leaves a transferred buffer readable in the recorded call', () => {
    const [, b] = createWindowPair({ delivery: 'sync' })
    const frame = new Uint8Array([1, 2, 3])
    b.postMessage(frame, '*', [frame.buffer])
    assert.deepEqual([...(b.posted()[0] as Uint8Array)], [1, 2, 3])
  })
})
