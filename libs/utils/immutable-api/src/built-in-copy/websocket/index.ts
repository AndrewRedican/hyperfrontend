/**
 * Safe factory for the WebSocket constructor, captured at load so later
 * prototype pollution cannot reach it.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/websocket
 */

// compat: node<22 the WebSocket global arrived in Node 22, so until the floor passes it the constructor may be absent at load; the ready-state constants then hold the values the WebSocket standard fixes and construction fails at call time
const _WebSocket = typeof globalThis.WebSocket === 'function' ? globalThis.WebSocket : undefined
const _Reflect = globalThis.Reflect
const _TypeError = globalThis.TypeError
const _freeze = globalThis.Object.freeze

/**
 * (Safe copy) Creates a new WebSocket using the captured WebSocket constructor.
 * Use this instead of `new WebSocket()`.
 *
 * @param url - The URL to connect to.
 * @param protocols - Optional sub-protocol string or array of strings.
 * @returns A new WebSocket instance.
 * @throws {TypeError} When the runtime has no WebSocket constructor (Node.js before 22).
 *
 * @example Creating WebSocket connection
 * ```typescript
 * const socket = createWebSocket('wss://api.example.com/stream')
 * socket.onmessage = (event) => console.log(event.data)
 * ```
 */
export const createWebSocket = (url: string | URL, protocols?: string | string[]): WebSocket => {
  if (_WebSocket === undefined) {
    throw new _TypeError('WebSocket is not available in this environment')
  }
  return _Reflect.construct(_WebSocket, [url, protocols]) as WebSocket
}

// magic: 0, 1, 2 and 3 are the readyState values the WebSocket standard fixes, so they are the right answer wherever the constructor is missing
const readyStates: Pick<WebSocket, 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED'> =
  _WebSocket === undefined
    ? { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }
    : { CONNECTING: _WebSocket.CONNECTING, OPEN: _WebSocket.OPEN, CLOSING: _WebSocket.CLOSING, CLOSED: _WebSocket.CLOSED }

/**
 * WebSocket ready state constants (safe copies).
 */
export const CONNECTING = readyStates.CONNECTING
export const OPEN = readyStates.OPEN
export const CLOSING = readyStates.CLOSING
export const CLOSED = readyStates.CLOSED

/**
 * (Safe copy) Namespace object containing all WebSocket utilities.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const WebSocket = _freeze({
  createWebSocket,
  CONNECTING,
  OPEN,
  CLOSING,
  CLOSED,
} as const)
