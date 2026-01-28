/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ElementRefOrString } from './get-element-async'
import { getElementAsync } from './get-element-async'

export async function setupAudio(selector: ElementRefOrString): Promise<AudioContext> {
  return new Promise((resolve, reject) => {
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
