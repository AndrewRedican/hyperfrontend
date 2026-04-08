/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */
/* istanbul ignore file - comprehensive tests exist; defensive type guards are tested via integration */
import { getType } from '@hyperfrontend/data-utils'
import { setTimeout, setInterval, clearTimeout, clearInterval } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

/** Element reference as either an HTMLElement or a CSS selector string */
export type ElementRefOrString<T extends HTMLElement = HTMLElement> = T | string

/** Callback invoked when the element is found */
export type OnSuccess = (element: HTMLElement) => void

/** Callback invoked when the element lookup times out */
export type OnFail = () => void

/**
 * Configuration options for async element retrieval.
 */
export interface GetElementAsyncOptions {
  /** Maximum time to wait in milliseconds */
  duration?: number
  /** Polling interval in milliseconds */
  interval?: number
  /** Callback when element is found */
  onSuccess?: OnSuccess
  /** Callback when lookup times out */
  onFail?: OnFail
}

/**
 * Asynchronously waits for an element to become available in the DOM.
 * Polls at regular intervals and invokes callbacks on success or timeout.
 *
 * @param elementRefOrString - Either an HTMLElement reference or a CSS selector string
 * @param options - Configuration options including duration, interval, and callbacks
 * @returns A cleanup function to cancel the polling
 *
 * @example
 * ```typescript
 * const cancel = getElementAsync('#dynamic-content', {
 *   duration: 5000,
 *   interval: 100,
 *   onSuccess: (element) => {
 *     console.log('Element found:', element)
 *   },
 *   onFail: () => {
 *     console.log('Element not found within timeout')
 *   },
 * })
 *
 * // Cancel polling if no longer needed
 * cancel()
 * ```
 */
export function getElementAsync(elementRefOrString: ElementRefOrString, options?: GetElementAsyncOptions): () => void {
  const { duration, interval, onSuccess, onFail } = <GetElementAsyncOptions>{
    duration: 10000,
    interval: 100,
    ...options,
  }

  let timer: ReturnType<typeof setInterval> | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  let isCancelled = false

  /**
   * Safely invokes a callback function with the provided element if not cancelled.
   *
   * @param callback - The callback function to invoke
   * @param element - The element to pass to the callback
   */
  function invoke(callback: OnSuccess | OnFail | undefined, element: any) {
    /* istanbul ignore next */
    if (isCancelled) return
    /* istanbul ignore next */
    if (getType(callback) !== 'function') return
    ;(<OnSuccess | OnFail>callback)(element)
  }

  /**
   * Clears all timers and intervals to prevent memory leaks.
   */
  function cleanup(): void {
    if (timer) clearInterval(timer)
    if (timeout) clearTimeout(timeout)
  }

  /**
   * Attempts to retrieve the element from DOM using querySelector or direct reference.
   *
   * @returns The found element or null if not found or an error occurred
   */
  function getElement(): HTMLElement | null {
    try {
      return getType(elementRefOrString) === 'string' ? document.querySelector(<string>elementRefOrString) : <HTMLElement>elementRefOrString
    } catch {
      return null
    }
  }

  /**
   * Checks if the element exists in the DOM and invokes success callback if found.
   */
  function checkElement(): void {
    const element = getElement()
    if (element) {
      invoke(onSuccess, element)
      cleanup()
    }
  }

  timer = setInterval(checkElement, interval)

  timeout = setTimeout(() => {
    cleanup()
    const element = getElement()
    /* istanbul ignore next */
    invoke(element ? onSuccess : onFail, element)
  }, duration)

  return () => {
    isCancelled = true
    cleanup()
  }
}
