/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MessageHandler, Queue } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { createError, createTypeError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

// magic: Once this many pulled slots sit at the front of the backing array it is compacted, so the queue never holds a long dead prefix and never shifts on every pull.
const COMPACT_AFTER = 1024

/**
 * Creates a message processing queue with FIFO ordering.
 *
 * Messages are processed strictly one at a time in arrival order; the next one starts only
 * after the handler's promise settles. That ordering is what lets a protocol assign a
 * monotonically increasing counter to each frame it seals or opens.
 *
 * @param processMessage - The handler function to process each message
 * @param autoStart - Whether to automatically start processing messages (default: true)
 * @returns A Queue instance with methods to manage message processing
 * @throws {Error} When processMessage is not a function or autoStart is not a boolean
 *
 * @example Creating a message processing queue
 * ```typescript
 * const queue = createQueue(async (message) => {
 *   await processMessage(message)
 * })
 * queue.addMessage({ type: 'ping', data: {} })
 * ```
 */
export function createQueue<T extends Record<string, any> = any>(processMessage: MessageHandler<T>, autoStart = true): Queue<T> {
  if (getType(processMessage) !== 'function') {
    throw createError('processMessage must be a function')
  }
  if (getType(autoStart) !== 'boolean') {
    throw createError('autoStart must be a boolean')
  }
  // why: An array with a moving head pulls in constant time; a Set-backed list has to skip every deleted slot on each pull and drains quadratically once it has depth.
  let items: T[] = []
  let head = 0
  let isProcessing = false
  let currentMsg: T | null = null
  let shouldStop = false

  const size = (): number => items.length - head

  const pull = (): T => {
    const message = items[head] as T
    head += 1
    if (head === items.length) {
      items = []
      head = 0
    } else if (head >= COMPACT_AFTER) {
      items = items.slice(head)
      head = 0
    }
    return message
  }

  const addMessage = (message: T): void => {
    if (getType(message) !== 'object' || message === null) {
      throw createTypeError('Message must be a non-null object')
    }

    items.push(message)
    if (autoStart && !isProcessing) {
      processQueue()
    }
  }

  const isRunning = (): boolean => isProcessing

  const stop = (): void => {
    shouldStop = true
  }

  const resume = (): void => {
    shouldStop = false
    if (!isProcessing && size() > 0) {
      processQueue()
    }
  }

  const currentMessage = (): T | null => currentMsg

  /**
   * Processes messages from the queue sequentially.
   * Continues processing until the queue is empty or stopped.
   */
  async function processQueue() {
    if (isProcessing) return
    isProcessing = true

    while (!shouldStop && size() > 0) {
      currentMsg = pull()
      await processMessage(currentMsg)
    }

    isProcessing = false
    currentMsg = null

    if (!shouldStop && size() > 0) {
      processQueue()
    }
  }

  const result: Queue<T> = {
    addMessage,
    isRunning,
    stop,
    resume,
    size,
    currentMessage,
  }

  return freeze(result)
}
