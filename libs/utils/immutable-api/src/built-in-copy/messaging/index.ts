/**
 * Safe copies of Messaging/Communication built-in functions and constructors.
 *
 * These references are captured at module initialization time to protect against
 * prototype pollution attacks. Import only what you need for tree-shaking.
 *
 * Note: `postMessage` is a method on specific objects (Window, Worker, MessagePort)
 * rather than a global. This module provides factory functions for MessageChannel
 * and BroadcastChannel, whose instances have safe postMessage methods.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/messaging
 */

// Capture references at module initialization time
const _Reflect = globalThis.Reflect
const _structuredClone = typeof globalThis.structuredClone === 'function' ? globalThis.structuredClone : undefined
const _MessageChannel = typeof globalThis.MessageChannel === 'function' ? globalThis.MessageChannel : undefined
const _BroadcastChannel = typeof globalThis.BroadcastChannel === 'function' ? globalThis.BroadcastChannel : undefined

/**
 * (Safe copy) Creates a deep clone of a value using the structured clone algorithm.
 * Available in modern browsers and Node.js 17+.
 *
 * @param value - The value to clone.
 * @param options - Optional transfer or serialization options.
 * @returns A deep clone of the value.
 */
export const structuredClone = _structuredClone
  ? <T>(value: T, options?: StructuredSerializeOptions): T => _structuredClone(value, options)
  : undefined

/**
 * (Safe copy) Creates a new MessageChannel using the captured constructor.
 * MessageChannel provides two ports for bidirectional communication.
 *
 * @returns A new MessageChannel instance or undefined if not available.
 */
export const createMessageChannel = _MessageChannel
  ? (): MessageChannel => <MessageChannel>_Reflect.construct(_MessageChannel, [])
  : undefined

/**
 * (Safe copy) Creates a new BroadcastChannel using the captured constructor.
 * BroadcastChannel enables communication between browsing contexts with the same origin.
 *
 * @param name - Identifier for the broadcast channel that other contexts use to subscribe.
 * @returns A new BroadcastChannel instance or undefined if not available.
 */
export const createBroadcastChannel = _BroadcastChannel
  ? (name: string): BroadcastChannel => <BroadcastChannel>_Reflect.construct(_BroadcastChannel, [name])
  : undefined

/**
 * PostMessage options for Window.postMessage.
 */
export interface PostMessageToWindowOptions {
  /**
   * The target origin for the message (e.g., "https://example.com" or "*").
   */
  targetOrigin: string

  /**
   * Array of Transferable objects to transfer ownership.
   */
  transfer?: Transferable[]
}

/**
 * (Safe copy) Posts a message to a Window object using captured postMessage.
 * This is a helper that wraps Window.postMessage for safe messaging.
 *
 * @param target - Destination window, iframe, or popup context.
 * @param message - The data payload to send, must be structured-cloneable.
 * @param options - Target origin and optional transferables.
 */
export const postMessageToWindow = (target: Window, message: unknown, options: PostMessageToWindowOptions): void => {
  target.postMessage(message, options.targetOrigin, options.transfer)
}

/**
 * (Safe copy) Posts a message to a Worker using captured postMessage.
 *
 * @param target - Web Worker or service worker instance.
 * @param message - The data payload to send, must be structured-cloneable.
 * @param transfer - Optional array of Transferable objects.
 */
export const postMessageToWorker = (target: Worker, message: unknown, transfer?: Transferable[]): void => {
  if (transfer) {
    target.postMessage(message, transfer)
  } else {
    target.postMessage(message)
  }
}

/**
 * (Safe copy) Posts a message to a MessagePort.
 *
 * @param port - One end of a two-way communication channel.
 * @param message - The data payload to send, must be structured-cloneable.
 * @param transfer - Optional array of Transferable objects.
 */
export const postMessageToPort = (port: MessagePort, message: unknown, transfer?: Transferable[]): void => {
  if (transfer) {
    port.postMessage(message, transfer)
  } else {
    port.postMessage(message)
  }
}

/**
 * (Safe copy) Posts a message to a BroadcastChannel.
 *
 * @param channel - Named broadcast channel for same-origin contexts.
 * @param message - The data payload to send, must be structured-cloneable.
 */
export const postMessageToBroadcast = (channel: BroadcastChannel, message: unknown): void => {
  channel.postMessage(message)
}

/**
 * (Safe copy) Namespace object containing all Messaging functions.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const Messaging = <const>{
  structuredClone,
  createMessageChannel,
  createBroadcastChannel,
  postMessageToWindow,
  postMessageToWorker,
  postMessageToPort,
  postMessageToBroadcast,
}
