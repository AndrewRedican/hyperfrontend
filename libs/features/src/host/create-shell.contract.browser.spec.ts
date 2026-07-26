import type { FeatureContract } from '../shared/types'
import { createShell } from './create-shell'

// note: '[nexus] new-message' is the wire action type a feature-side broker sends for a user message; dispatching it on the host window drives the real inbound routing path.
const NEW_MESSAGE = '[nexus] new-message'
const REQUEST_CONNECTION = '[nexus] connection-request'
const ACCEPT_CONNECTION = '[nexus] connection-request-accepted'
const FEATURE_ORIGIN = 'https://feature.example'

const contract: FeatureContract = {
  emitted: [{ type: 'timeUpdated' }],
  accepted: [{ type: 'setTimezone' }],
}

const mountFeature = (): {
  send: (type: string, data?: unknown) => void
  on: (event: string, handler: (data?: unknown) => void) => void
  frame: HTMLIFrameElement
} => {
  const container = document.createElement('div')
  container.id = 'shell'
  document.body.appendChild(container)
  const shell = createShell({ container: '#shell', url: `${FEATURE_ORIGIN}/`, contract })
  shell.open()
  const frame = <HTMLIFrameElement>container.querySelector('iframe')
  return { send: shell.send, on: shell.on, frame }
}

// how: Plays the hostee side of the wire handshake: captures the shell's
const openViaWire = (frame: HTMLIFrameElement): void => {
  const featureWindow = frame.contentWindow
  if (!featureWindow) throw new Error('The mounted iframe has no content window.')
  const post = jest.fn()
  featureWindow.postMessage = post
  jest.advanceTimersByTime(500)
  const request = <{ processId: string } | undefined>(
    post.mock.calls.map((call) => <{ type: string }>call[0]).find((action) => action.type === REQUEST_CONNECTION)
  )
  if (!request) throw new Error('The shell never sent a connection request.')
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        type: ACCEPT_CONNECTION,
        processId: request.processId,
        senderId: 'feature-broker',
        contract,
      },
      source: featureWindow,
      origin: FEATURE_ORIGIN,
    })
  )
}

const dispatchFeatureMessage = (frame: HTMLIFrameElement, type: string, data?: unknown): void => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { type: NEW_MESSAGE, senderId: 'feature-broker', data: { type, data } },
      source: frame.contentWindow,
      origin: FEATURE_ORIGIN,
    })
  )
}

describe('createShell contract orientation', () => {
  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
    document.body.innerHTML = ''
  })

  it('sends an action from the feature-accepted list without a contract violation', () => {
    const { send } = mountFeature()
    expect(() => send('setTimezone', { tz: 'UTC' })).not.toThrow()
  })

  it('rejects sending an action the feature only emits, even before the wire opens', () => {
    const { send } = mountFeature()
    expect(() => send('timeUpdated', { iso: 'now' })).toThrow('not in the emitted actions')
  })

  it('completes the wire handshake and flushes a queued send to the feature', () => {
    const { send, frame } = mountFeature()
    send('setTimezone', { tz: 'UTC' })

    openViaWire(frame)

    expect((<jest.Mock>frame.contentWindow?.postMessage).mock.calls.map((call) => (<{ type: string }>call[0]).type)).toEqual(
      expect.arrayContaining(['[nexus] connection-opened', NEW_MESSAGE])
    )
  })

  it('delivers an incoming feature-emitted event to subscribed handlers', () => {
    const { on, frame } = mountFeature()
    openViaWire(frame)
    const handler = jest.fn()
    on('timeUpdated', handler)
    dispatchFeatureMessage(frame, 'timeUpdated', { iso: '2026-07-03T00:00:00Z' })
    expect(handler).toHaveBeenCalledWith({ iso: '2026-07-03T00:00:00Z' })
  })

  it('drops an incoming message type outside the feature-emitted list', () => {
    const { on, frame } = mountFeature()
    openViaWire(frame)
    const handler = jest.fn()
    on('rogueEvent', handler)
    dispatchFeatureMessage(frame, 'rogueEvent', {})
    expect(handler).not.toHaveBeenCalled()
  })

  it('drops an incoming message from an origin that does not match the pinned feature origin', () => {
    const { on, frame } = mountFeature()
    openViaWire(frame)
    const handler = jest.fn()
    on('timeUpdated', handler)
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: NEW_MESSAGE, senderId: 'feature-broker', data: { type: 'timeUpdated', data: {} } },
        source: frame.contentWindow,
        origin: 'https://evil.example',
      })
    )
    expect(handler).not.toHaveBeenCalled()
  })

  it('keeps the generic default contract uninverted when no contract is given', () => {
    const container = document.createElement('div')
    container.id = 'shell'
    document.body.appendChild(container)
    const shell = createShell({ container: '#shell', url: `${FEATURE_ORIGIN}/` })
    shell.open()
    expect(() => shell.send('MESSAGE', {})).not.toThrow()
  })
})
