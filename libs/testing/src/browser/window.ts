import type { MockFn } from '../mock/types'
import { createMockFn } from '../mock/mock-fn'

/**
 * A stand-in for a browser window as cross-window messaging sees it, accepted wherever a
 * `Window` is expected.
 */
export interface FakeWindow extends Window {
  /** Records every message posted to this window, and delivers it when the window is linked. */
  postMessage: MockFn
  /** Registers a listener, as a window does. Calls are recorded. */
  addEventListener: MockFn
  /** Removes a listener, as a window does. Calls are recorded. */
  removeEventListener: MockFn
  /** The origin this window's own documents run in, compared against a post's target origin. */
  readonly origin: string
  /** Dispatches a `message` event to this window's listeners now, as if another window had posted it. */
  receive(data: unknown, from?: MessageSender): void
  /** The data of every message posted to this window, in order, whether or not it was delivered. */
  posted(): unknown[]
  /** How many `message` listeners are registered. */
  messageListenerCount(): number
}

/**
 * Where a message dispatched with `receive` claims to come from.
 */
export type MessageSender = {
  /** The sender's origin. Defaults to the window's own origin. */
  origin?: string
  /** The sending window. Defaults to null. */
  source?: Window | null
}

/**
 * How a standalone fake window presents itself.
 */
export type FakeWindowOptions = {
  /** The window's origin. Defaults to `http://localhost`. */
  origin?: string
}

/**
 * How a linked pair of fake windows behaves.
 */
export type WindowPairOptions = {
  /** The two windows' origins. Defaults to `http://a.test` and `http://b.test`. */
  origins?: readonly [string, string]
  /** `task` delivers a post on a later timer task, as a browser does; `sync` delivers it inside the call. Defaults to `task`. */
  delivery?: 'task' | 'sync'
}

/**
 * A registered listener: a function or an object with `handleEvent`.
 */
type Listener = EventListenerOrEventListenerObject

/**
 * One registration, with the options that change how it is called.
 */
type Registration = {
  /** What to call. */
  listener: Listener
  /** Whether the registration is dropped after its first call. */
  once: boolean
}

/**
 * Builds a message event that claims an arbitrary window as its source.
 *
 * Node's own `MessageEvent` accepts only a `MessagePort` as the source, so the event is
 * created without one and the source is defined on the instance, which reads the same to
 * a listener under Node and under jsdom.
 *
 * @param data - What the listener reads as `event.data`.
 * @param origin - The sender's origin.
 * @param source - The window that sent the message, or null.
 * @returns A `message` event carrying all three.
 */
function messageEvent(data: unknown, origin: string, source: Window | null): MessageEvent {
  const event = new MessageEvent('message', { data, origin })
  Object.defineProperty(event, 'source', { value: source, configurable: true, enumerable: true })
  return event
}

/**
 * Reads the target origin from either `postMessage` signature.
 *
 * @param options - The second argument: a target origin, or an options object.
 * @returns The target origin, `*` when none was given.
 */
function targetOriginOf(options: unknown): string {
  if (typeof options === 'string') return options
  return (options as WindowPostMessageOptions | undefined)?.targetOrigin ?? '*'
}

/**
 * Builds a fake window whose `postMessage` hands each message to `deliver`.
 *
 * @param origin - Compared against a post's target origin, and reported as `origin` and `location.origin`.
 * @param deliver - Receives each post, or is absent for a window that only records.
 * @returns A window whose listener registry and recorded posts are its own.
 */
function buildWindow(origin: string, deliver?: (window: FakeWindow, data: unknown, targetOrigin: string) => void): FakeWindow {
  const registrations: Registration[] = []
  const dispatch = (event: MessageEvent): void => {
    for (const registration of [...registrations]) {
      if (registration.once) registrations.splice(registrations.indexOf(registration), 1)
      const { listener } = registration
      if (typeof listener === 'function') listener.call(fake, event)
      else listener.handleEvent(event)
    }
  }
  const fake = {
    origin,
    location: { origin },
    postMessage: createMockFn((data: unknown, options?: unknown) => deliver?.(fake, data, targetOriginOf(options))),
    addEventListener: createMockFn((type: string, listener: Listener | null, options?: boolean | AddEventListenerOptions) => {
      if (type !== 'message' || !listener || registrations.some((registration) => registration.listener === listener)) return
      registrations.push({ listener, once: typeof options === 'object' && options.once === true })
    }),
    removeEventListener: createMockFn((type: string, listener: Listener | null) => {
      const index = registrations.findIndex((registration) => registration.listener === listener)
      if (type === 'message' && index !== -1) registrations.splice(index, 1)
    }),
    receive: (data: unknown, from: MessageSender = {}) => dispatch(messageEvent(data, from.origin ?? origin, from.source ?? null)),
    posted: () => fake.postMessage.mock.calls.map((call: unknown[]) => call[0]),
    messageListenerCount: () => registrations.length,
  } as unknown as FakeWindow
  return fake
}

/**
 * Creates a window that records what is posted to it and delivers nothing on its own.
 *
 * Use it as the target a piece of code posts to, asserting on `posted`, or as the window a
 * piece of code listens on, feeding it messages with `receive`.
 *
 * @param options - The window's origin.
 * @returns The window, typed as a `Window`.
 * @example Feeding a listener a message from another origin
 * ```ts
 * const host = createFakeWindow({ origin: 'https://host.test' })
 * const stop = listenForCommands(host)
 * host.receive({ type: 'PING' }, { origin: 'https://feature.test' })
 * expect(host.posted()).toEqual([{ type: 'PONG' }])
 * ```
 */
export function createFakeWindow(options: FakeWindowOptions = {}): FakeWindow {
  return buildWindow(options.origin ?? 'http://localhost')
}

/**
 * Creates two windows that can message each other, as a page and the frame or popup it opened.
 *
 * Posting to one window delivers to that window's own listeners, with the other window as
 * the event's `source` and the other window's origin as its `origin`, exactly as a browser
 * reports a message one window sent another. A post whose target origin is neither `*` nor
 * the receiving window's origin is dropped, as a browser drops it, with `/` standing for the
 * sender's own origin. The message is copied with `structuredClone`, so the receiver never
 * shares an object with the sender; a transfer list is ignored, which leaves the posted
 * buffers readable for assertions. By default delivery waits for a later timer task, which
 * fake timers control.
 *
 * @param options - The windows' origins and when a post is delivered.
 * @returns The two windows, each typed as a `Window`.
 * @example Connecting two brokers across a frame boundary
 * ```ts
 * const [host, frame] = createWindowPair({ origins: ['https://host.test', 'https://frame.test'] })
 * const hostBroker = createBroker({ window: host })
 * const frameBroker = createBroker({ window: frame })
 * hostBroker.addChannel('frame', frame).connect()
 * frameBroker.addChannel('host', host).connect()
 * await waitUntil(() => hostBroker.isConnected())
 * ```
 */
export function createWindowPair(options: WindowPairOptions = {}): readonly [FakeWindow, FakeWindow] {
  const [originA, originB] = options.origins ?? ['http://a.test', 'http://b.test']
  const counterpart = new Map<FakeWindow, FakeWindow>()
  const deliver = (receiver: FakeWindow, data: unknown, targetOrigin: string): void => {
    const sender = counterpart.get(receiver) as FakeWindow
    const expected = targetOrigin === '/' ? sender.origin : targetOrigin
    if (expected !== '*' && expected !== receiver.origin) return
    const copy = structuredClone(data)
    const send = (): void => receiver.receive(copy, { origin: sender.origin, source: sender })
    if (options.delivery === 'sync') send()
    else setTimeout(send, 0)
  }
  const a = buildWindow(originA, deliver)
  const b = buildWindow(originB, deliver)
  counterpart.set(a, b).set(b, a)
  return [a, b]
}
