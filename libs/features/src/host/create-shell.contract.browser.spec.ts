import type { FeatureContract } from '../shared/types'
import { createShell } from './create-shell'

// note: '[nexus] new-message' is the wire action type a feature-side broker sends for a user message; dispatching it on the host window drives the real inbound routing path.
const NEW_MESSAGE = '[nexus] new-message'

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
  const shell = createShell({ container: '#shell', url: 'https://feature.example/', contract })
  shell.open()
  const frame = <HTMLIFrameElement>container.querySelector('iframe')
  return { send: shell.send, on: shell.on, frame }
}

const dispatchFeatureMessage = (frame: HTMLIFrameElement, type: string, data?: unknown): void => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { type: NEW_MESSAGE, senderId: 'feature-broker', data: { type, data } },
      source: frame.contentWindow,
    })
  )
}

describe('createShell contract orientation', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('sends an action from the feature-accepted list without a contract violation', () => {
    const { send } = mountFeature()
    expect(() => send('setTimezone', { tz: 'UTC' })).not.toThrow()
  })

  it('rejects sending an action the feature only emits', () => {
    const { send } = mountFeature()
    expect(() => send('timeUpdated', { iso: 'now' })).toThrow('not in the emitted actions')
  })

  it('delivers an incoming feature-emitted event to subscribed handlers', () => {
    const { on, frame } = mountFeature()
    const handler = jest.fn()
    on('timeUpdated', handler)
    dispatchFeatureMessage(frame, 'timeUpdated', { iso: '2026-07-03T00:00:00Z' })
    expect(handler).toHaveBeenCalledWith({ iso: '2026-07-03T00:00:00Z' })
  })

  it('drops an incoming message type outside the feature-emitted list', () => {
    const { on, frame } = mountFeature()
    const handler = jest.fn()
    on('rogueEvent', handler)
    dispatchFeatureMessage(frame, 'rogueEvent', {})
    expect(handler).not.toHaveBeenCalled()
  })

  it('keeps the generic default contract uninverted when no contract is given', () => {
    const container = document.createElement('div')
    container.id = 'shell'
    document.body.appendChild(container)
    const shell = createShell({ container: '#shell', url: 'https://feature.example/' })
    shell.open()
    expect(() => shell.send('MESSAGE', {})).not.toThrow()
  })
})
