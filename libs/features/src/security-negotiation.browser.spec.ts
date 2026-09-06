import type { Mock } from '@hyperfrontend/testing'
import type { ShellHandle } from './host/types'
import type { FeatureHandle } from './hostee/types'
import type { FeatureContract, SecurityProtocol, ShellOptions } from './shared/types'
import { afterEach, beforeEach } from 'node:test'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { createBroker } from '@hyperfrontend/nexus'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createHeartbeatMonitor } from './host/heartbeat'
import { createShellHandle } from './host/lifecycle'
import { createFeatureHandle } from './hostee/lifecycle'
import { withControlContract } from './shared/control'
import { createEventEmitter } from './shared/event-emitter'
import { invertFeatureContract } from './shared/invert-contract'
import { registerSecurity } from './shared/security'
import { installResizeObserverStub } from './testing/resize-observer-stub'

// why: Both sides connect, so their REQUESTs cross and nexus breaks the glare by yielding the lower broker id. Ranking the first eight digits of every id minted while a broker is created turns which side answers the other's REQUEST into a test input instead of a coin toss; the real generator still supplies the unique tail.
jest.mock('@hyperfrontend/random-generator-utils', () => ({
  ...jest.requireActual<object>('@hyperfrontend/random-generator-utils'),
  uuidV4: () =>
    `${(process.env['HF_SPEC_UUID_RANK'] ?? '7').repeat(8)}${jest.requireActual<{ uuidV4: () => string }>('@hyperfrontend/random-generator-utils').uuidV4().slice(8)}`,
}))

const PSK = 'features-two-party-shared-key'
const OTHER_PSK = 'a-different-key-the-host-never-held'
const HOST_ORIGIN = 'https://host.example.com'
const FEATURE_ORIGIN = 'https://feature.example.com'
// magic: Long enough for the handshake to complete on this machine, short enough that a session the keys never confirm ends well inside the test budget.
const SHORT_DEADLINE_MS = 500

const featureContract: FeatureContract = { emitted: [{ type: 'timeUpdated' }], accepted: [{ type: 'setTimezone' }] }

// note: The feature validates inbound setTimezone payloads; the host-side twin below omits the schema to model a skewed contract copy.
const schemaContract: FeatureContract = {
  emitted: [{ type: 'timeUpdated' }],
  accepted: [{ type: 'setTimezone', schema: { type: 'object', properties: { timezone: { type: 'string' } }, required: ['timezone'] } }],
}

type MessageListener = (event: MessageEvent) => void

interface StubWindow extends Partial<Window> {
  /** Records every frame the counterpart posts to this window. */
  postMessage: Mock
  /** Registers broker message listeners. */
  addEventListener: Mock
  /** Removes broker message listeners. */
  removeEventListener: Mock
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

// how: Mirrors real postMessage semantics: posting to a window dispatches to that window's own listeners on a later task, with the counterpart as the source, so a reply never lands inside the call that provoked it. Sealed frames travel as the Uint8Array they were posted as; the transfer list is irrelevant in-process.
function linkStubWindows(hostWindow: StubWindow, featureWindow: StubWindow): void {
  hostWindow.postMessage.mockImplementation((data: unknown) => {
    setTimeout(() => {
      hostWindow._dispatchMessage(new MessageEvent('message', { data, origin: FEATURE_ORIGIN, source: featureWindow as unknown as Window }))
    }, 0)
  })
  featureWindow.postMessage.mockImplementation((data: unknown) => {
    setTimeout(() => {
      featureWindow._dispatchMessage(new MessageEvent('message', { data, origin: HOST_ORIGIN, source: hostWindow as unknown as Window }))
    }, 0)
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

/** Which side of a crossing-REQUEST glare a broker takes; the lower rank yields and answers as responder. */
type GlareRank = 'yields' | 'wins'

const RANK_DIGIT: Record<GlareRank, string> = { yields: '0', wins: 'f' }

function mintBrokerWithRank<T>(rank: GlareRank | undefined, mint: () => T): T {
  if (rank === undefined) {
    return mint()
  }
  process.env['HF_SPEC_UUID_RANK'] = RANK_DIGIT[rank]
  try {
    return mint()
  } finally {
    delete process.env['HF_SPEC_UUID_RANK']
  }
}

/** The security selection one side of a pair connects with. */
interface SecuritySelection {
  /** The envelope to negotiate. */
  protocol?: SecurityProtocol
  /** The pre-shared key for v4. */
  sharedKey?: string
  /** The handshake deadline, which also bounds the session confirmation. */
  deadlineMs?: number
}

const V4: SecuritySelection = { protocol: 'v4', sharedKey: PSK }
const V3: SecuritySelection = { protocol: 'v3' }
const UNSECURED: SecuritySelection = {}

describe('Integration: host and hostee across the security envelope', () => {
  let hostWindow: StubWindow
  let featureWindow: StubWindow
  // why: a test may open more than one pair, and each handle starts a heartbeat and a visibility watcher. Holding only the last one would leave the earlier intervals running, which keeps the process alive after the suite has finished.
  const shells: ShellHandle[] = []
  const features: FeatureHandle[] = []

  beforeEach(() => {
    installResizeObserverStub()
    hostWindow = createStubWindow()
    featureWindow = createStubWindow()
    linkStubWindows(hostWindow, featureWindow)
  })

  afterEach(() => {
    // why: Frames still in flight when a test ends must not reach the brokers of a finished pair, where an unanswered REQUEST would mint a channel nothing tears down.
    hostWindow.postMessage.mockReset()
    featureWindow.postMessage.mockReset()
    for (const handle of features.splice(0)) handle.close()
    for (const handle of shells.splice(0)) handle.destroy()
  })

  interface Party<Handle> {
    handle: Handle
    received: unknown[]
    errors: unknown[]
    /** Every error and close in the order the handle emitted them. */
    events: unknown[]
    /** The protocol nexus confirmed the session on, once `security-ready` fires on the underlying channel. */
    secured: () => string | null
  }

  interface HostParty extends Party<ShellHandle> {
    /** The mount cleanup the shell runs when it tears the feature down. */
    cleanup: Mock
  }

  function openHostShell(hostView: FeatureContract = featureContract, security: SecuritySelection = V4, rank?: GlareRank): HostParty {
    const contract = withControlContract(invertFeatureContract(hostView))
    const broker = mintBrokerWithRank(rank, () => createBroker({ name: 'shell-host', contract, window: hostWindow as unknown as Window }))
    const emitter = createEventEmitter()
    const received: unknown[] = []
    const errors: unknown[] = []
    const events: unknown[] = []
    let secured: string | null = null
    emitter.on('timeUpdated', (data) => received.push(data))
    emitter.on('error', (data) => {
      errors.push(data)
      events.push({ event: 'error', data })
    })
    emitter.on('close', (data) => events.push({ event: 'close', data }))
    const cleanup = jest.fn()
    const handle = createShellHandle(
      broker,
      {
        container: '#shell',
        url: `${FEATURE_ORIGIN}/`,
        protocol: security.protocol,
        sharedKey: security.sharedKey,
        openTimeoutMs: security.deadlineMs,
      } as ShellOptions,
      emitter,
      {
        contract,
        selectMount: () => () => ({ target: featureWindow as unknown as Window, present: { mode: 'embedded' }, cleanup }),
        registerSecurity,
        createHeartbeatMonitor,
        observeVisibility: () => () => undefined,
      }
    )
    shells.push(handle)
    handle.open()
    broker.getChannel('feature-1')?.on('security-ready', (data) => {
      secured = data.protocol
    })
    return { handle, received, errors, events, secured: () => secured, cleanup }
  }

  // why: The feature broker comes alive only here, after the host is already retrying its REQUEST: the same ordering as a real feature page loading inside the shell's iframe.
  function connectFeature(
    featureView: FeatureContract = featureContract,
    security: SecuritySelection = V4,
    rank?: GlareRank
  ): Party<FeatureHandle> {
    const contract = withControlContract(featureView)
    const broker = mintBrokerWithRank(rank, () =>
      createBroker({ name: 'clock-feature', contract, window: featureWindow as unknown as Window })
    )
    const emitter = createEventEmitter()
    const received: unknown[] = []
    const errors: unknown[] = []
    const events: unknown[] = []
    let secured: string | null = null
    emitter.on('setTimezone', (data) => received.push(data))
    emitter.on('error', (data) => {
      errors.push(data)
      events.push({ event: 'error', data })
    })
    emitter.on('close', (data) => events.push({ event: 'close', data }))
    const handle = createFeatureHandle(broker, hostWindow as unknown as Window, emitter, {
      contract,
      protocol: security.protocol,
      sharedKey: security.sharedKey,
      readyTimeoutMs: security.deadlineMs,
    })
    features.push(handle)
    broker.getChannel('host')?.on('security-ready', (data) => {
      secured = data.protocol
    })
    return { handle, received, errors, events, secured: () => secured }
  }

  async function openSecuredPair(security: SecuritySelection): Promise<{ host: HostParty; feature: Party<FeatureHandle> }> {
    const host = openHostShell(featureContract, security)
    const feature = connectFeature(featureContract, security)
    await feature.handle.ready()
    // why: The session opens before the hello exchange confirms it; sealed traffic is only provable once both transports report ready.
    await waitFor(() => host.handle.isOpen && host.secured() !== null && feature.secured() !== null, 120)
    return { host, feature }
  }

  const framesTo = (target: StubWindow) => target.postMessage.mock.calls.map((call) => call[0] as unknown)

  const plaintextFrames = (target: StubWindow) => framesTo(target).filter((frame) => !(frame instanceof Uint8Array))

  const isHandshakeFrame = (frame: unknown) => (frame as { type: string }).type.startsWith('[nexus] connection-')

  const hasClosed = (party: Party<unknown>) => party.events.some((entry) => (entry as { event: string }).event === 'close')

  describe('v4 security envelope', () => {
    it('confirms the session on both sides once the hello exchange completes', async () => {
      const { host, feature } = await openSecuredPair(V4)
      expect({ host: host.secured(), feature: feature.secured() }).toEqual({ host: 'v4', feature: 'v4' })
    }, 20_000)

    it('flushes host sends queued before the handshake as ciphertext after open', async () => {
      const host = openHostShell()
      host.handle.send('setTimezone', { timezone: 'UTC', marker: 'classified-payload' })
      const featureParty = connectFeature()

      await waitFor(() => featureParty.received.length === 1)

      expect({
        delivered: featureParty.received,
        encrypted: framesTo(featureWindow).some((frame) => frame instanceof Uint8Array),
        plaintextLeaks: plaintextFrames(featureWindow).filter((frame) => stringify(frame).includes('classified-payload')),
        nonHandshakePlaintext: plaintextFrames(featureWindow).filter((frame) => !isHandshakeFrame(frame)),
      }).toEqual({
        delivered: [{ timezone: 'UTC', marker: 'classified-payload' }],
        encrypted: true,
        plaintextLeaks: [],
        nonHandshakePlaintext: [],
      })
    }, 20_000)

    it('delivers feature replies encrypted once the session is confirmed', async () => {
      const { host, feature } = await openSecuredPair(V4)

      feature.handle.send('timeUpdated', { time: 'classified-reply' })
      await waitFor(() => host.received.length === 1)

      expect({
        delivered: host.received,
        encrypted: framesTo(hostWindow).some((frame) => frame instanceof Uint8Array),
        plaintextLeaks: plaintextFrames(hostWindow).filter((frame) => stringify(frame).includes('classified-reply')),
        nonHandshakePlaintext: plaintextFrames(hostWindow).filter((frame) => !isHandshakeFrame(frame)),
      }).toEqual({
        delivered: [{ time: 'classified-reply' }],
        encrypted: true,
        plaintextLeaks: [],
        nonHandshakePlaintext: [],
      })
    }, 20_000)
  })

  describe('v3 security envelope', () => {
    it('seals traffic both ways without a pre-shared key', async () => {
      const { host, feature } = await openSecuredPair(V3)

      host.handle.send('setTimezone', { timezone: 'UTC', marker: 'classified-payload' })
      feature.handle.send('timeUpdated', { time: 'classified-reply' })
      await waitFor(() => host.received.length === 1 && feature.received.length === 1)

      expect({
        secured: { host: host.secured(), feature: feature.secured() },
        delivered: { host: host.received, feature: feature.received },
        plaintextLeaks: [...plaintextFrames(hostWindow), ...plaintextFrames(featureWindow)].filter((frame) =>
          stringify(frame).includes('classified')
        ),
      }).toEqual({
        secured: { host: 'v3', feature: 'v3' },
        delivered: { host: [{ time: 'classified-reply' }], feature: [{ timezone: 'UTC', marker: 'classified-payload' }] },
        plaintextLeaks: [],
      })
    }, 20_000)

    // why: The SDK's payload-less beat must survive the envelope; a rejected beat would drive every pairing suspect three seconds after open with the miss budget exhausted.
    it('keeps the watchdog healthy past the miss threshold under the envelope', async () => {
      const host = openHostShell(featureContract, V3)
      const states: string[] = []
      host.handle.on('status', (data) => states.push((data as { state: string }).state))
      const featureParty = connectFeature(featureContract, V3)
      await featureParty.handle.ready()
      await waitFor(() => host.handle.isOpen)

      // how: Four beat intervals of real time, one past the three-tick miss budget, so a dying beat is guaranteed to have driven the watchdog suspect by now.
      await createPromise((resolve) => setTimeout(resolve, 4200))

      expect({ states, hostErrors: host.errors, featureErrors: featureParty.errors }).toEqual({
        states: ['healthy'],
        hostErrors: [],
        featureErrors: [],
      })
    }, 20_000)
  })

  describe('v4 key mismatch', () => {
    const hostKey: SecuritySelection = { protocol: 'v4', sharedKey: PSK, deadlineMs: SHORT_DEADLINE_MS }
    const featureKey: SecuritySelection = { protocol: 'v4', sharedKey: OTHER_PSK, deadlineMs: SHORT_DEADLINE_MS }
    const unconfirmed = { event: 'error', data: expect.objectContaining({ reason: 'security-error', code: 'security-unconfirmed' }) }

    it('closes the host session as unconfirmed once the deadline passes without a confirming frame', async () => {
      const host = openHostShell(featureContract, hostKey)
      connectFeature(featureContract, featureKey)

      await waitFor(() => hasClosed(host))

      expect({ tail: host.events.slice(-2), open: host.handle.isOpen }).toEqual({
        tail: [unconfirmed, { event: 'close', data: undefined }],
        open: false,
      })
    }, 20_000)

    it('closes the feature session as unconfirmed too', async () => {
      openHostShell(featureContract, hostKey)
      const featureParty = connectFeature(featureContract, featureKey)

      await waitFor(() => hasClosed(featureParty))

      expect(featureParty.events.slice(-2)).toEqual([unconfirmed, { event: 'close', data: undefined }])
    }, 20_000)

    it('never delivers a queued host send under keys the feature does not hold', async () => {
      const host = openHostShell(featureContract, hostKey)
      host.handle.send('setTimezone', { timezone: 'UTC', marker: 'classified-payload' })
      const featureParty = connectFeature(featureContract, featureKey)

      await waitFor(() => hasClosed(host))

      expect({
        delivered: featureParty.received,
        plaintextLeaks: plaintextFrames(featureWindow).filter((frame) => stringify(frame).includes('classified-payload')),
      }).toEqual({ delivered: [], plaintextLeaks: [] })
    }, 20_000)
  })

  describe('fail-closed protocol mismatch', () => {
    const unavailable = expect.objectContaining({ reason: 'security-unavailable' })
    const REFUSED_NEGOTIATION =
      'The host refused the connection (security-unavailable): Security is required for this channel but the counterpart cannot negotiate an encrypted protocol.'

    describe('v4 host meeting a v3 feature', () => {
      it('denies on both sides and tears the mount down', async () => {
        const host = openHostShell(featureContract, V4)
        const featureParty = connectFeature(featureContract, V3)

        await waitFor(() => host.errors.length > 0 && featureParty.errors.length > 0)

        expect({
          hostErrors: host.errors,
          featureErrors: featureParty.errors,
          hostOpen: host.handle.isOpen,
          mountCleaned: host.cleanup.mock.calls.length,
        }).toEqual({ hostErrors: [unavailable], featureErrors: [unavailable], hostOpen: false, mountCleaned: 1 })
      }, 20_000)

      it('rejects the feature ready promise with the refusal', async () => {
        openHostShell(featureContract, V4)
        const featureParty = connectFeature(featureContract, V3)

        await expect(featureParty.handle.ready()).rejects.toThrow(REFUSED_NEGOTIATION)
      }, 20_000)
    })

    describe('v4 host meeting an unsecured feature', () => {
      it('denies the feature request outright when the host answers it', async () => {
        const host = openHostShell(featureContract, V4, 'yields')
        const featureParty = connectFeature(featureContract, UNSECURED, 'wins')

        await waitFor(() => host.errors.length > 0 && featureParty.errors.length > 0)

        expect({ hostErrors: host.errors, featureErrors: featureParty.errors, mountCleaned: host.cleanup.mock.calls.length }).toEqual({
          hostErrors: [unavailable],
          featureErrors: [unavailable],
          mountCleaned: 1,
        })
      }, 20_000)

      it('rejects the feature ready promise with the refusal when the host answers its request', async () => {
        openHostShell(featureContract, V4, 'yields')
        const featureParty = connectFeature(featureContract, UNSECURED, 'wins')

        await expect(featureParty.handle.ready()).rejects.toThrow(REFUSED_NEGOTIATION)
      }, 20_000)

      it('abandons its own request over a plaintext acceptance and tears the mount down', async () => {
        const host = openHostShell(featureContract, V4, 'wins')
        connectFeature(featureContract, UNSECURED, 'yields')

        await waitFor(() => host.cleanup.mock.calls.length > 0)

        expect({ hostErrors: host.errors, hostOpen: host.handle.isOpen }).toEqual({ hostErrors: [unavailable], hostOpen: false })
      }, 20_000)

      // why: The host abandons its own handshake with a CANCEL rather than a DENY, so the feature learns only that the host walked away before open.
      it('rejects the feature ready promise with the cancellation when the host abandons its request', async () => {
        openHostShell(featureContract, V4, 'wins')
        const featureParty = connectFeature(featureContract, UNSECURED, 'yields')

        await expect(featureParty.handle.ready()).rejects.toThrow('The host cancelled the connection before it opened.')
      }, 20_000)
    })

    describe('unsecured host meeting a v4 feature', () => {
      it('is denied by the feature when the feature answers its request', async () => {
        const host = openHostShell(featureContract, UNSECURED, 'wins')
        const featureParty = connectFeature(featureContract, V4, 'yields')

        await waitFor(() => host.errors.length > 0 && featureParty.errors.length > 0)

        expect({ hostErrors: host.errors, featureErrors: featureParty.errors, mountCleaned: host.cleanup.mock.calls.length }).toEqual({
          hostErrors: [unavailable],
          featureErrors: [unavailable],
          mountCleaned: 1,
        })
      }, 20_000)

      it('is cancelled by the feature abandoning the plaintext acceptance the host answered with', async () => {
        const host = openHostShell(featureContract, UNSECURED, 'yields')
        const featureParty = connectFeature(featureContract, V4, 'wins')

        await waitFor(() => host.cleanup.mock.calls.length > 0 && featureParty.errors.length > 0)

        expect({ hostErrors: host.errors, featureErrors: featureParty.errors }).toEqual({
          hostErrors: [{ reason: 'handshake-cancelled', displayMode: 'embedded' }],
          featureErrors: [unavailable],
        })
      }, 20_000)

      it('rejects the feature ready promise when the feature abandons the plaintext acceptance', async () => {
        openHostShell(featureContract, UNSECURED, 'yields')
        const featureParty = connectFeature(featureContract, V4, 'wins')

        await expect(featureParty.handle.ready()).rejects.toThrow(
          'The host refused the connection (security-unavailable): Security is required for this channel but the counterpart cannot provide an encrypted protocol.'
        )
      }, 20_000)
    })
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
