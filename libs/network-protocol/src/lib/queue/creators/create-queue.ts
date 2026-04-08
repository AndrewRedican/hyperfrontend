/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MessageHandler, Queue } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { createError, createTypeError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createFifoList } from '@hyperfrontend/list-utils'

/**
 * Creates a message processing queue with FIFO ordering.
 * Provides methods to add messages, control processing, and monitor queue state.
 *
 * @param processMessage - The handler function to process each message
 * @param autoStart - Whether to automatically start processing messages (default: true)
 * @returns A Queue instance with methods to manage message processing
 * @throws {Error} When processMessage is not a function or autoStart is not a boolean
 *
 * @example
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
  const fifoQueue = createFifoList<T>()
  let isProcessing = false
  let currentMsg: T | null = null
  let shouldStop = false

  const addMessage = (message: T): void => {
    if (getType(message) !== 'object' || message === null) {
      throw createTypeError('Message must be a non-null object')
    }

    fifoQueue.push(message)
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
    if (!isProcessing && fifoQueue.size() > 0) {
      processQueue()
    }
  }

  const size = (): number => fifoQueue.size()

  const currentMessage = (): T | null => currentMsg

  /**
   * Processes messages from the queue sequentially.
   * Continues processing until the queue is empty or stopped.
   */
  async function processQueue() {
    if (isProcessing) return
    isProcessing = true

    while (!shouldStop && fifoQueue.size() > 0) {
      const message = fifoQueue.pull()
      if (message) {
        currentMsg = message
        await processMessage(message)
      }
    }

    isProcessing = false
    currentMsg = null

    if (!shouldStop && fifoQueue.size() > 0) {
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
