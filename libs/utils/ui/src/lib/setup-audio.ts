/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ElementRefOrString } from './get-element-async'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { getElementAsync } from './get-element-async'

/**
 * Sets up an AudioContext by waiting for user interaction on a specified element.
 * Required for browsers that block audio without user gesture.
 *
 * @param selector - Either an HTMLElement reference or a CSS selector string for the target element
 * @returns A promise that resolves to an AudioContext once the user interacts with the element
 * @throws {Error} When the target element is not found
 */
export async function setupAudio(selector: ElementRefOrString): Promise<AudioContext> {
  return createPromise((resolve, reject) => {
    const initializeAudioContext = (event: Event) => {
      const audioContext = new (globalThis.AudioContext || (globalThis as any).webkitAudioContext)()

      const target = event.currentTarget
      /* istanbul ignore next */
      if (!target) return

      target.removeEventListener('click', initializeAudioContext)
      target.removeEventListener('touchstart', initializeAudioContext)

      resolve(audioContext)
    }

    return getElementAsync(selector, {
      onSuccess: (targetElement) => {
        targetElement.addEventListener('click', initializeAudioContext)
        targetElement.addEventListener('touchstart', initializeAudioContext)
      },
      onFail: () => {
        reject(new Error(`Element with selector "${selector}" not found.`))
      },
    })
  })
}
