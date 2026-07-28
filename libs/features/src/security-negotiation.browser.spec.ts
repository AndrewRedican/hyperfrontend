import type { ShellHandle } from './host/types'
import type { FeatureHandle } from './hostee/types'
import type { FeatureContract, ShellOptions } from './shared/types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { createBroker } from '@hyperfrontend/nexus'
import { createHeartbeatMonitor } from './host/heartbeat'
import { createShellHandle } from './host/lifecycle'
import { createFeatureHandle } from './hostee/lifecycle'
import { withControlContract } from './shared/control'
import { createEventEmitter } from './shared/event-emitter'
import { invertFeatureContract } from './shared/invert-contract'
import { registerSecurity } from './shared/security'

const PSK = 'features-two-party-shared-key'
const HOST_ORIGIN = 'https://host.example.com'
const FEATURE_ORIGIN = 'https://feature.example.com'

const featureContract: FeatureContract = { emitted: [{ type: 'timeUpdated' }], accepted: [{ type: 'setTimezone' }] }

// note: The feature validates inbound setTimezone payloads; the host-side twin below omits the schema to model a skewed contract copy.
const schemaContract: FeatureContract = {
  emitted: [{ type: 'timeUpdated' }],
  accepted: [{ type: 'setTimezone', schema: { type: 'object', properties: { timezone: { type: 'string' } }, required: ['timezone'] } }],
}

type MessageListener = (event: MessageEvent) => void

interface StubWindow extends Partial<Window> {
  /** Records every frame the counterpart posts to this window. */
  postMessage: jest.Mock
  /** Registers broker message listeners. */
  addEventListener: jest.Mock
  /** Removes broker message listeners. */
  removeEventListener: jest.Mock
  /** Dispatches a message event to the registered listeners. */
  _dispatchMessage: (event: MessageEvent) => void
}

function createStubWindow(): StubWindow {
  const listeners: MessageListener[] = []
  return {
    postMessage: jest.fn(),
    addEventListener: jest.fn((type: string, listener: MessageListener) => {
      if (type === 'message') {
        listeners.push(listener)
      }
    }),
    removeEventListener: jest.fn((type: string, listener: MessageListener) => {
      const index = listeners.indexOf(listener)
      if (type === 'message' && index !== -1) {
        listeners.splice(index, 1)
      }
    }),
    _dispatchMessage: (event: MessageEvent) => listeners.forEach((listener) => listener(event)),
  }
}

// how: Mirrors real postMessage semantics — posting to a window dispatches to that window's own listeners with the counterpart as the source.
function linkStubWindows(hostWindow: StubWindow, featureWindow: StubWindow): void {
  hostWindow.postMessage.mockImplementation((data: unknown) => {
    hostWindow._dispatchMessage(new MessageEvent('message', { data, origin: FEATURE_ORIGIN, source: <Window>(<unknown>featureWindow) }))
  })
  featureWindow.postMessage.mockImplementation((data: unknown) => {
    featureWindow._dispatchMessage(new MessageEvent('message', { data, origin: HOST_ORIGIN, source: <Window>(<unknown>hostWindow) }))
  })
}

async function waitFor(condition: () => boolean, attempts = 240): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (condition()) {
      return
    }
    await createPromise((resolve) => setTimeout(resolve, 25))
  }
  throw createError('Timed out waiting for condition')
}

class ResizeObserverStub {
  observe() {
    return undefined
  }
  unobserve() {
    return undefined
  }
  disconnect() {
    return undefined
  }
}

describe('Integration: host and hostee across the hardened handshake', () => {
  let hostWindow: StubWindow
  let featureWindow: StubWindow
  let shell: ShellHandle | null = null
  let feature: FeatureHandle | null = null

  beforeEach(() => {
    Object.defineProperty(globalThis, 'ResizeObserver', { value: ResizeObserverStub, configurable: true, writable: true })
    hostWindow = createStubWindow()
    featureWindow = createStubWindow()
    linkStubWindows(hostWindow, featureWindow)
  })

  afterEach(() => {
    shell?.destroy()
    shell = null
    feature?.close()
    feature = null
  })

  interface Party<Handle> {
    handle: Handle
    received: unknown[]
    errors: unknown[]
  }

  function openHostShell(hostView: FeatureContract = featureContract): Party<ShellHandle> {
    const contract = withControlContract(invertFeatureContract(hostView))
    const broker = createBroker({
      name: 'shell-host',
      contract,
      window: <Window>(<unknown>hostWindow),
    })
    const emitter = createEventEmitter()
    const received: unknown[] = []
    const errors: unknown[] = []
    emitter.on('timeUpdated', (data) => received.push(data))
    emitter.on('error', (data) => errors.push(data))
    const handle = createShellHandle(
      broker,
      <ShellOptions>{ container: '#shell', url: `${FEATURE_ORIGIN}/`, protocol: 'v2', sharedKey: PSK },
      emitter,
      {
        contract,
        selectMount: () => () => ({ target: <Window>(<unknown>featureWindow), cleanup: () => undefined }),
        registerSecurity,
        createHeartbeatMonitor,
        observeVisibility: () => () => undefined,
      }
    )
    shell = handle
    handle.open()
    return { handle, received, errors }
  }

  // why: The feature broker comes alive only here, after the host is already retrying its REQUEST — the same ordering as a real feature page loading inside the shell's iframe.
  function connectFeature(featureView: FeatureContract = featureContract): Party<FeatureHandle> {
    const contract = withControlContract(featureView)
    const broker = createBroker({
      name: 'clock-feature',
      contract,
      window: <Window>(<unknown>featureWindow),
    })
    const emitter = createEventEmitter()
    const received: unknown[] = []
    const errors: unknown[] = []
    emitter.on('setTimezone', (data) => received.push(data))
    emitter.on('error', (data) => errors.push(data))
    const handle = createFeatureHandle(broker, <Window>(<unknown>hostWindow), emitter, { contract, protocol: 'v2', sharedKey: PSK })
    feature = handle
    return { handle, received, errors }
  }

  const framesTo = (target: StubWindow) => target.postMessage.mock.calls.map((call) => <unknown>call[0])

  const plaintextFrames = (target: StubWindow) => framesTo(target).filter((frame) => !(frame instanceof Uint8Array))

  describe('v2 security envelope', () => {
    it('flushes host sends queued before the handshake as ciphertext after open', async () => {
      const host = openHostShell()
      host.handle.send('setTimezone', { timezone: 'UTC', marker: 'classified-payload' })
      const featureParty = connectFeature()

      await waitFor(() => featureParty.received.length === 1)

      expect({
        delivered: featureParty.received,
        encrypted: framesTo(featureWindow).some((frame) => frame instanceof Uint8Array),
        plaintextLeaks: plaintextFrames(featureWindow).filter((frame) => stringify(frame).includes('classified-payload')),
        nonHandshakePlaintext: plaintextFrames(featureWindow).filter(
          (frame) => !(<{ type: string }>frame).type.startsWith('[nexus] connection-')
        ),
      }).toEqual({
        delivered: [{ timezone: 'UTC', marker: 'classified-payload' }],
        encrypted: true,
        plaintextLeaks: [],
        nonHandshakePlaintext: [],
      })
    }, 20_000)

    it('delivers feature replies encrypted once the channel is open', async () => {
      const host = openHostShell()
      const featureParty = connectFeature()
      await featureParty.handle.ready()

      featureParty.handle.send('timeUpdated', { time: 'classified-reply' })
      await waitFor(() => host.received.length === 1)

      expect({
        delivered: host.received,
        encrypted: framesTo(hostWindow).some((frame) => frame instanceof Uint8Array),
        plaintextLeaks: plaintextFrames(hostWindow).filter((frame) => stringify(frame).includes('classified-reply')),
      }).toEqual({
        delivered: [{ time: 'classified-reply' }],
        encrypted: true,
        plaintextLeaks: [],
      })
    }, 20_000)
  })

  describe('contract-version gate', () => {
    it('opens a pair whose announced versions differ only below the major', async () => {
      const host = openHostShell({ ...featureContract, version: '1.9.3' })
      const featureParty = connectFeature({ ...featureContract, version: '1.2.0' })

      await featureParty.handle.ready()
      await waitFor(() => host.handle.isOpen)

      expect({ hostOpen: host.handle.isOpen, hostErrors: host.errors, featureErrors: featureParty.errors }).toEqual({
        hostOpen: true,
        hostErrors: [],
        featureErrors: [],
      })
    }, 20_000)

    it('denies a major-mismatch pair before open and surfaces the error on both handles', async () => {
      const host = openHostShell({ ...featureContract, version: '2.0.0' })
      const featureParty = connectFeature({ ...featureContract, version: '1.0.0' })

      await waitFor(() => host.errors.length > 0 && featureParty.errors.length > 0)

      expect({ hostOpen: host.handle.isOpen, hostErrors: host.errors, featureErrors: featureParty.errors }).toEqual({
        hostOpen: false,
        hostErrors: [
          expect.objectContaining({ reason: 'incompatible-contract', error: expect.stringContaining('Incompatible contract versions') }),
        ],
        featureErrors: [
          expect.objectContaining({ reason: 'incompatible-contract', error: expect.stringContaining('Incompatible contract versions') }),
        ],
      })
    }, 20_000)
  })

  describe('payload validation', () => {
    it('throws in the host frame when a send payload violates its emitted schema', async () => {
      const host = openHostShell(schemaContract)
      const featureParty = connectFeature(schemaContract)
      await featureParty.handle.ready()

      expect(() => host.handle.send('setTimezone', {})).toThrow("Invalid payload for action 'setTimezone'")
    }, 20_000)

    it('drops an inbound payload violating the accepted schema and surfaces invalid-payload', async () => {
      const host = openHostShell(featureContract)
      const featureParty = connectFeature(schemaContract)
      await featureParty.handle.ready()

      host.handle.send('setTimezone', { sabotage: true })
      await waitFor(() => featureParty.errors.length === 1)

      expect({ delivered: featureParty.received, errors: featureParty.errors }).toEqual({
        delivered: [],
        errors: [
          {
            reason: 'invalid-payload',
            type: 'setTimezone',
            errors: [expect.objectContaining({ message: 'Missing required property: timezone' })],
          },
        ],
      })
    }, 20_000)
  })
})
