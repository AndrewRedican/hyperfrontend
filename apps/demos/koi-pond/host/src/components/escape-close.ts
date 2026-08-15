/**
 * The pond's Escape key.
 *
 * Once a visitor clicks into the pond, keyboard focus lives in this document —
 * a host page listening for Escape on its own window never hears it. So the
 * pond listens itself and turns the key into the contract's `close-request`,
 * exactly as the dialog ✕ does; the host still owns the presentation and
 * performs the actual close.
 *
 * The key means "let go of what I am holding" before it means "leave": while a
 * koi is held for inspection, Escape releases it and goes no further.
 */
import type { FeatureUi } from '../runtime/feature-ui'

/**
 * Listens for Escape and routes it to the scene, then to the host.
 *
 * @param target - The window to listen on.
 * @param ui - The presentation-fed UI state that emits the close-request.
 * @param releaseHeld - Releases any held koi; returns `true` when one was held.
 * @returns A function that removes the listener.
 *
 * @example Arming Escape at boot
 * ```typescript
 * wireEscapeClose(window, featureUi, () => scene.releaseHeld())
 * ```
 */
export function wireEscapeClose(target: Window, ui: FeatureUi, releaseHeld: () => boolean): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') {
      return
    }
    if (releaseHeld()) {
      return
    }
    ui.requestClose('escape')
  }
  target.addEventListener('keydown', onKeyDown)
  return () => {
    target.removeEventListener('keydown', onKeyDown)
  }
}
