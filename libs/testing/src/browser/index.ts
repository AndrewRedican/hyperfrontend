/**
 * Stand-ins for the browser surfaces a DOM-free test cannot supply: linked windows that
 * message each other, and a `ResizeObserver` the test drives.
 *
 * @module @hyperfrontend/testing/browser
 */
export type { ObservedSize, ResizeObserverController } from './resize-observer'
export type { FakeWindow, FakeWindowOptions, MessageSender, WindowPairOptions } from './window'
export { installResizeObserver } from './resize-observer'
export { createFakeWindow, createWindowPair } from './window'
