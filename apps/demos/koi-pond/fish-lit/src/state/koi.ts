import type { KoiFishElement } from '../koi/koi-fish'
import '../koi/koi-fish'

/**
 * Looks up the koi element, failing loudly when the markup drifts.
 *
 * @returns The custom element that draws the koi.
 */
function koiElement(): KoiFishElement {
  // why: Registering the element upgrades the tag already parsed into the page, so the element behind it exists by the time this returns.
  const found = document.querySelector('koi-fish')
  if (found === null) {
    throw new Error('missing element: koi-fish')
  }
  return found
}

/** The app-wide koi element; it births the shared runtime, wired to the live feature handle, once its template first renders. */
export const fish: KoiFishElement = koiElement()
