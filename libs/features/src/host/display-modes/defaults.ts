import type { ResolvedSize } from '../../shared/presentation'
import { resolveDynamicSize } from '../../shared/presentation'

/**
 * Dynamic default footprint for the popup display mode, recomputed on each
 * access from the live host viewport. Per-open `popupWidth`/`popupHeight`
 * (and the feature's baked popup defaults) take precedence.
 *
 * @returns The resolved width and height in pixels.
 *
 * @example Sizing a popup window
 * ```typescript
 * const { width, height } = resolvePopupDefaults()
 * ```
 */
export function resolvePopupDefaults(): ResolvedSize {
  return resolveDynamicSize(window.innerWidth, window.innerHeight)
}
