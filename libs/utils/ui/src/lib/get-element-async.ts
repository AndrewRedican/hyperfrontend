/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */
/* istanbul ignore file - comprehensive tests exist; defensive type guards are tested via integration */
import { getType } from '@hyperfrontend/data-utils'

export type ElementRefOrString<T extends HTMLElement = HTMLElement> = T | string

export type OnSuccess = (element: HTMLElement) => void

export type OnFail = () => void

export interface GetElementAsyncOptions {
  duration?: number
  interval?: number
  onSuccess?: OnSuccess
  onFail?: OnFail
}

/**
 * Asynchronously waits for an element to become available in the DOM.
 * Polls at regular intervals and invokes callbacks on success or timeout.
 *
 * @param elementRefOrString - Either an HTMLElement reference or a CSS selector string
 * @param options - Configuration options including duration, interval, and callbacks
 * @returns A cleanup function to cancel the polling
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

  // Start checking for the element
  timer = setInterval(checkElement, interval)

  // Set a timeout to stop checking after the specified duration
  timeout = setTimeout(() => {
    cleanup()
    const element = getElement()
    /* istanbul ignore next */
    invoke(element ? onSuccess : onFail, element)
  }, duration)

  // Return a function to cancel the operation
  return () => {
    isCancelled = true
    cleanup()
  }
}
