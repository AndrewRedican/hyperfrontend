import { createKoiRuntime } from '../runtime/koi-runtime'

/**
 * Looks up the app root, failing loudly when the markup drifts.
 *
 * @returns The root element the koi is drawn into.
 */
function appRoot(): HTMLElement {
  const found = document.querySelector<HTMLElement>('#app')
  if (found === null) {
    throw new Error('missing element: #app')
  }
  return found
}

/** The app-wide koi; wired to the live feature handle at boot. */
export const koi = createKoiRuntime(appRoot())
