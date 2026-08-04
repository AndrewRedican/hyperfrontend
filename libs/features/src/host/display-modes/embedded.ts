import type { ResolvedSize } from '../../shared/presentation'
import type { ShellOptions } from '../../shared/types'
import type { DisplayModeMount } from '../types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { DisplayMode } from '../../shared/types'
import { createFeatureIframe, frameReadiness, resolveContainer } from '../iframe'
import { createContainerReporter, measureContentBox } from '../sizing'

/**
 * Resolves the fixed embedded footprint from the merged options, when one is
 * agreed.
 *
 * @param options - The merged shell options.
 * @returns The exact pixel size, or `null` for container-driven sizing.
 * @throws {Error} When only one axis is set, or an axis is not a positive number.
 */
function resolveFixedSize(options: ShellOptions): ResolvedSize | null {
  const { embedWidth, embedHeight } = options
  if (embedWidth === undefined && embedHeight === undefined) {
    return null
  }
  if (embedWidth === undefined || embedHeight === undefined) {
    throw createError('Fixed embedded sizing needs both "embedWidth" and "embedHeight"; set both or neither.')
  }
  if (!(embedWidth > 0) || !(embedHeight > 0)) {
    throw createError(`Fixed embedded dimensions must be positive numbers, but got ${embedWidth}x${embedHeight}.`)
  }
  return { width: embedWidth, height: embedHeight }
}

/**
 * Mounts a feature inline inside the host-provided container element.
 *
 * By default the iframe fills the container's content box — measured before
 * the iframe is inserted, so the announcement carries the container's own
 * dimensions — and a reporter forwards every later change (with
 * viewport-derived fallback dimensions while the container has none). When
 * the merged options agree a fixed `embedWidth`/`embedHeight`, the iframe
 * receives exactly those dimensions and the host application places the
 * container so the feature fits. The frame mounts hidden and is revealed once
 * the session opens.
 *
 * @param context - Inputs the shell passes to this display mode.
 * @param context.options - The merged shell options.
 * @returns The iframe content window, the iframe as the mounted element, the presentation announcement, the viewport reporter (container-driven sizing only), and the reveal/teardown hooks.
 *
 * @example Mounting embedded
 * ```typescript
 * const { target, cleanup } = mountEmbedded({ options, requestClose })
 * ```
 */
export const mountEmbedded: DisplayModeMount = ({ options }) => {
  const container = resolveContainer(options.container)
  const fixed = resolveFixedSize(options)
  // why: Measured before insertion so the reading reflects what the host's layout gives the container, not what the frame itself props open.
  const measured = fixed ?? measureContentBox(container)
  const iframe = createFeatureIframe(options.url ?? '', options)
  if (fixed) {
    iframe.style.width = `${fixed.width}px`
    iframe.style.height = `${fixed.height}px`
  }
  const viewport = fixed ? undefined : createContainerReporter(container, iframe, measured)
  container.appendChild(iframe)
  return {
    target: iframe.contentWindow,
    element: iframe,
    present: { mode: DisplayMode.Embedded, viewport: viewport ? viewport.current() : { width: measured.width, height: measured.height } },
    viewport,
    whenReady: frameReadiness(iframe, options.url ?? ''),
    reveal: () => {
      iframe.style.visibility = 'visible'
    },
    cleanup: () => {
      viewport?.stop()
      iframe.remove()
    },
  }
}
