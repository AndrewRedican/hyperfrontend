import type { DisplayModeMount } from '../types'
import { createFeatureIframe, resolveContainer } from '../iframe'

/**
 * Mounts a feature inline inside the host-provided container element.
 *
 * @param context - Inputs the shell passes to this display mode.
 * @param context.options - The merged shell options.
 * @returns The iframe content window, the iframe as the mounted element, and a teardown that removes the iframe.
 *
 * @example Mounting embedded
 * ```typescript
 * const { target, cleanup } = mountEmbedded({ options, requestClose })
 * ```
 */
export const mountEmbedded: DisplayModeMount = ({ options }) => {
  const container = resolveContainer(options.container)
  const iframe = createFeatureIframe(options.url ?? '')
  container.appendChild(iframe)
  return {
    target: iframe.contentWindow,
    element: iframe,
    frame: iframe,
    cleanup: () => iframe.remove(),
  }
}
