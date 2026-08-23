import { createKoiRuntime } from '@hyperfrontend/demo-koi-lib'
import { createKoiRenderer } from '../koi/koi-render'
import { feature } from '../hyperfrontend.feature'

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

/** The app-wide koi; born wired to the live feature handle. */
export const koi = createKoiRuntime({
  framework: 'svelte',
  root: appRoot(),
  link: feature,
  rendererFactory: createKoiRenderer,
  // why: Whether a host embeds this app comes from the SDK handle, never from the window above this frame.
  hosted: feature.hosted,
})
