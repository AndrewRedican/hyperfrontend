/* istanbul ignore file */

import type { IAction } from '../types/action'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

/**
 * Type representing a message listener function
 */
type MessageListener = (event: MessageEvent) => void

/**
 * Mock window interface for testing
 */
export interface MockWindow extends Partial<Window> {
  /** Mock postMessage function */
  postMessage: jest.Mock
  /** Mock addEventListener function */
  addEventListener: jest.Mock
  /** Mock removeEventListener function */
  removeEventListener: jest.Mock
  /** Internal: Get all registered message listeners */
  _getMessageListeners: () => MessageListener[]
  /** Internal: Dispatch a message event to all listeners */
  _dispatchMessage: (event: MessageEvent) => void
}

/**
 * Creates a mock window object that simulates postMessage behavior.
 *
 * The mock tracks message listeners and allows simulating message delivery
 * between windows for integration testing.
 *
 * @returns A mock window object with jest mock functions
 *
 * @example
 * ```typescript
 * const windowA = createMockWindow()
 * const windowB = createMockWindow()
 *
 * // Link them for bidirectional communication
 * linkMockWindows(windowA, windowB, 'http://host-a.com', 'http://host-b.com')
 * ```
 */
export function createMockWindow(): MockWindow {
  const listeners: MessageListener[] = []

  const mockWindow: MockWindow = {
    postMessage: jest.fn(),

    addEventListener: jest.fn((type: string, listener: MessageListener) => {
      if (type === 'message') {
        listeners.push(listener)
      }
    }),

    removeEventListener: jest.fn((type: string, listener: MessageListener) => {
      if (type === 'message') {
        const index = listeners.indexOf(listener)
        if (index !== -1) {
          listeners.splice(index, 1)
        }
      }
    }),

    _getMessageListeners: () => [...listeners],

    _dispatchMessage: (event: MessageEvent) => {
      listeners.forEach((listener) => listener(event))
    },
  }

  return mockWindow
}

/**
 * Links two mock windows for bidirectional communication.
 *
 * When windowA calls postMessage, windowB receives the message and vice versa.
 * This simulates the real browser behavior of cross-frame communication.
 *
 * @param windowA - First mock window
 * @param windowB - Second mock window
 * @param originA - Origin URL for window A (e.g., 'http://host-a.com')
 * @param originB - Origin URL for window B (e.g., 'http://host-b.com')
 *
 * @example
 * ```typescript
 * const windowA = createMockWindow()
 * const windowB = createMockWindow()
 * linkMockWindows(windowA, windowB, 'http://host-a.com', 'http://host-b.com')
 * ```
 */
export function linkMockWindows(windowA: MockWindow, windowB: MockWindow, originA: string, originB: string): void {
  windowA.postMessage.mockImplementation((data: unknown) => {
    const event = new MessageEvent('message', {
      data,
      origin: originA,
      source: <Window>(<unknown>windowA),
    })
    setTimeout(() => windowB._dispatchMessage(event), 0)
  })

  windowB.postMessage.mockImplementation((data: unknown) => {
    const event = new MessageEvent('message', {
      data,
      origin: originB,
      source: <Window>(<unknown>windowB),
    })
    setTimeout(() => windowA._dispatchMessage(event), 0)
  })
}

/**
 * Simulates a message being sent to a window.
 *
 * Creates a MessageEvent and dispatches it to all registered message listeners
 * on the target window.
 *
 * @param targetWindow - The mock window to receive the message
 * @param message - The action/message data to send
 * @param origin - The origin URL of the sender
 * @param source - Optional source window reference
 *
 * @example
 * ```typescript
 * simulateMessage(mockWindow, { type: 'PING' }, 'http://origin.com')
 * ```
 */
export function simulateMessage(targetWindow: MockWindow, message: IAction, origin: string, source?: MockWindow): void {
  const event = new MessageEvent('message', {
    data: message,
    origin,
    source: <Window>(<unknown>source) || null,
  })
  targetWindow._dispatchMessage(event)
}

/**
 * Creates a MessageEvent for testing without dispatching it.
 *
 * Useful when you need to test handler functions directly.
 *
 * @param data - The action/message data
 * @param origin - The origin URL
 * @param source - Optional source window
 * @returns A MessageEvent object
 *
 * @example
 * ```typescript
 * const event = createMessageEvent({ type: 'PING' }, 'http://origin.com')
 * handler(event)
 * ```
 */
export function createMessageEvent<T = IAction>(data: T, origin: string, source?: MockWindow): MessageEvent<T> {
  return new MessageEvent<T>('message', {
    data,
    origin,
    source: <Window>(<unknown>source) || null,
  })
}

/**
 * Waits for a specified number of milliseconds.
 *
 * Useful for waiting for async message delivery in tests.
 *
 * @param ms - Number of milliseconds to wait
 * @returns A promise that resolves after the specified time
 *
 * @example
 * ```typescript
 * await wait(100)
 * // 100ms have passed
 * ```
 */
export function wait(ms: number): Promise<void> {
  return createPromise((resolve) => setTimeout(resolve, ms))
}

/**
 * Flushes all pending timers and promises.
 *
 * Call this after operations that use setTimeout to ensure all
 * async operations complete.
 *
 * @example
 * ```typescript
 * windowA.postMessage({ type: 'PING' })
 * await flushAsync()
 * // All async callbacks have completed
 * ```
 */
export async function flushAsync(): Promise<void> {
  await wait(0)
  jest.runAllTimers()
  await wait(0)
}

/**
 * Creates a test contract for integration tests.
 *
 * @param emitted - Array of message types this side emits
 * @param accepted - Array of message types this side accepts
 * @returns A channel contract object
 *
 * @example
 * ```typescript
 * const contract = createTestContract(['PING'], ['PONG'])
 * // => { emitted: [{ type: 'PING' }], accepted: [{ type: 'PONG' }] }
 * ```
 */
export function createTestContract(emitted: string[] = [], accepted: string[] = []) {
  return {
    emitted: emitted.map((type) => ({ type })),
    accepted: accepted.map((type) => ({ type })),
  }
}

/**
 * Creates a pair of complementary contracts.
 *
 * What side A emits, side B accepts and vice versa.
 *
 * @param aEmits - Message types that side A emits (B accepts)
 * @param bEmits - Message types that side B emits (A accepts)
 * @returns Object with contractA and contractB
 *
 * @example
 * ```typescript
 * const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
 * // contractA emits PING, accepts PONG
 * // contractB emits PONG, accepts PING
 * ```
 */
export function createContractPair(aEmits: string[] = [], bEmits: string[] = []) {
  return {
    contractA: createTestContract(aEmits, bEmits),
    contractB: createTestContract(bEmits, aEmits),
  }
}
