/**
 * The app's root component.
 *
 * A frame and nothing in it. The project boots, React mounts, and the koi is
 * rendered here once the shared model is wired in.
 *
 * This is the one browser-facing module in the app. The other six koi replace
 * exactly this file with their own framework's idiom, and share everything else.
 *
 * @module @hyperfrontend/demo-koi-fish-react.app
 */
import type { ReactElement } from 'react'

/**
 * Renders the frame one koi swims in.
 *
 * @returns The box the koi will be drawn into.
 */
export function App(): ReactElement {
  return <div className="koi-frame" />
}
