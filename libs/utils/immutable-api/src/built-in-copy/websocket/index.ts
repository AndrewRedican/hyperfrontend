/**
 * Safe copies of WebSocket built-ins via factory functions.
 *
 * Provides safe references to WebSocket.
 * These references are captured at module initialization time to protect against
 * prototype pollution attacks. Import only what you need for tree-shaking.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/websocket
 */

// Capture references at module initialization time
const _WebSocket = globalThis.WebSocket
const _Reflect = globalThis.Reflect
const _freeze = globalThis.Object.freeze

/**
 * (Safe copy) Creates a new WebSocket using the captured WebSocket constructor.
 * Use this instead of `new WebSocket()`.
 *
 * @param url - The URL to connect to.
 * @param protocols - Optional sub-protocol string or array of strings.
 * @returns A new WebSocket instance.
 */
export const createWebSocket = (url: string | URL, protocols?: string | string[]): WebSocket =>
  <WebSocket>_Reflect.construct(_WebSocket, [url, protocols])

/**
 * WebSocket ready state constants (safe copies).
 */
export const CONNECTING = _WebSocket.CONNECTING
export const OPEN = _WebSocket.OPEN
export const CLOSING = _WebSocket.CLOSING
export const CLOSED = _WebSocket.CLOSED

/**
 * (Safe copy) Namespace object containing all WebSocket utilities.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const WebSocket = _freeze(<const>{
  createWebSocket,
  CONNECTING,
  OPEN,
  CLOSING,
  CLOSED,
})
