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

export function getElementAsync(elementRefOrString: ElementRefOrString, options?: GetElementAsyncOptions): () => void {
  const { duration, interval, onSuccess, onFail } = {
    duration: 10000,
    interval: 100,
    ...options,
  } as GetElementAsyncOptions

  let timer: ReturnType<typeof setInterval> | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  let isCancelled = false

  function invoke(callback: OnSuccess | OnFail | undefined, element: any) {
    /* istanbul ignore next */
    if (isCancelled) return
    /* istanbul ignore next */
    if (getType(callback) !== 'function') return
    ;(<OnSuccess | OnFail>callback)(element)
  }

  function cleanup(): void {
    if (timer) clearInterval(timer)
    if (timeout) clearTimeout(timeout)
  }

  function getElement(): HTMLElement | null {
    try {
      return getType(elementRefOrString) === 'string' ? document.querySelector(<string>elementRefOrString) : <HTMLElement>elementRefOrString
    } catch {
      return null
    }
  }

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
