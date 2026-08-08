/**
 * The app's root component.
 *
 * A frame and nothing in it. The project boots, Solid mounts, and the koi is
 * rendered here once the shared model is wired in.
 *
 * This is the one browser-facing module in the app. The other six koi replace
 * exactly this file with their own framework's idiom, and share everything else.
 *
 * @module @hyperfrontend/demo-koi-fish-solid.app
 */
import type { JSX } from 'solid-js'

/**
 * Renders the frame one koi swims in.
 *
 * @returns The box the koi will be drawn into.
 */
export function App(): JSX.Element {
  return <div class="koi-frame" />
}
