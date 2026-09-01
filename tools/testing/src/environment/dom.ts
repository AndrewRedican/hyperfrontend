import { createContext, runInContext } from 'node:vm'
import { JSDOM } from 'jsdom'

/**
 * Globals that stay Node's even though jsdom defines its own.
 *
 * The timer functions are what `mock.timers` replaces, so a jsdom copy would leave the
 * fake clock driving nothing. `performance` belongs with them. `crypto` is Node's
 * WebCrypto, which implements `subtle`; jsdom's supplies only `getRandomValues`. `URL`
 * and `URLSearchParams` stay Node's because `node:url` recognises its own class and not
 * the one whatwg-url exports.
 *
 * `atob` and `btoa` are here for a different reason, and it is the one to remember. Their
 * jsdom implementations delegate to the global of the same name, which is Node's inside
 * jsdom's own process. Copying one onto the global makes that call resolve to the copy, so
 * the function recurses until the stack is exhausted and reports the failure as its own
 * `InvalidCharacterError`. Anything shaped that way has to stay Node's; `clearTimeout` and
 * `queueMicrotask` are the only others, and both were already listed.
 */
const RESERVED = new Set([
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'queueMicrotask',
  'performance',
  'crypto',
  'URL',
  'URLSearchParams',
  'atob',
  'btoa',
])

/**
 * Reads the names a realm defines before anything is added to it.
 *
 * A bare VM context holds exactly the ECMAScript intrinsics, which is the set a jsdom
 * window must never overwrite: its `Array`, `Object` and `Promise` belong to a realm of
 * its own, so copying them across would make every `instanceof` in the process disagree
 * with itself. Deriving the set rather than listing it means a future language addition
 * is excluded without anyone having to notice it.
 *
 * @returns The intrinsic global names.
 */
function intrinsicNames(): Set<string> {
  const context = createContext({})
  return new Set(runInContext('Object.getOwnPropertyNames(globalThis)', context) as string[])
}

/**
 * Copies a jsdom window's globals onto the process global, so specs written against a
 * browser see `document`, `window`, and the DOM constructors.
 *
 * Values are read rather than their descriptors copied. `document`, `navigator` and
 * `location` are accessors whose getters check that they were called on a window, so a
 * descriptor moved verbatim onto `globalThis` would throw the moment it was read.
 *
 * @param window - The window to copy from.
 */
function copyGlobals(window: JSDOM['window']): void {
  const intrinsics = intrinsicNames()
  const source = window as unknown as Record<string, unknown>

  for (const name of Object.getOwnPropertyNames(window)) {
    if (intrinsics.has(name) || RESERVED.has(name)) continue

    try {
      Object.defineProperty(globalThis, name, { value: source[name], writable: true, configurable: true, enumerable: false })
    } catch {
      // why: a handful of window properties throw when read outside a browsing context, and a global that cannot be produced is one the suites cannot have been using.
      continue
    }
  }

  // why: a window inherits the EventTarget methods rather than owning them, and copying only its own properties would leave the global unable to listen or dispatch. They are bound to the window so a listener registered through the global and an event dispatched at it meet on the same target.
  for (const name of ['addEventListener', 'removeEventListener', 'dispatchEvent'] as const) {
    Object.defineProperty(globalThis, name, {
      value: (window[name] as (...args: unknown[]) => unknown).bind(window),
      writable: true,
      configurable: true,
      enumerable: false,
    })
  }
}

/**
 * Installs a DOM on the process global.
 *
 * This module is an `--import` entry, loaded after the resolution hooks and before a
 * project's own setup files, so a setup file may already assume `document` exists.
 *
 * `pretendToBeVisual` matches what the Jest environment this replaces asked for: it is
 * what supplies `requestAnimationFrame` and makes the document report itself as visible.
 */
export function installDom(): void {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  })

  copyGlobals(dom.window)

  // why: in a browser `window` is the global object, and the Jest environment this replaces made it so by running the tests inside the window. Here the globals are copies, so pointing `window` at the jsdom object would leave two slots holding one function: a spy installed on `window.getComputedStyle` would be invisible to code calling the bare `getComputedStyle`.
  for (const name of ['window', 'self', 'globalThis', 'parent', 'top'] as const) {
    Object.defineProperty(globalThis, name, { value: globalThis, writable: true, configurable: true, enumerable: false })
  }
}

installDom()
