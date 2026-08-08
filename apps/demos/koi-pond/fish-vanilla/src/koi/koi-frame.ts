/**
 * The app's root: the frame one koi swims in.
 *
 * A box and nothing in it. The project boots, the frame is built, and the koi
 * is rendered into it once the shared model is wired in.
 *
 * This is the one browser-facing module in the app. The other six koi replace
 * exactly this file with their own framework's idiom, and share everything else.
 *
 * @module @hyperfrontend/demo-koi-fish-vanilla.frame
 */

/**
 * Builds the frame and puts it on the page.
 *
 * @param root - The element the app was mounted into.
 * @returns The box the koi will be drawn into.
 *
 * @example Booting the app
 * ```typescript
 * mountKoiFrame(document.querySelector('#app'))
 * ```
 */
export function mountKoiFrame(root: HTMLElement): HTMLElement {
  const frame = document.createElement('div')
  frame.className = 'koi-frame'
  root.replaceChildren(frame)
  return frame
}
