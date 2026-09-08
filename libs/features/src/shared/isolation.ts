import type { DisplayMode, FeatureIsolation } from './types'
import { DisplayMode as Modes } from './types'

// note: Shared by the config validator and the mode resolver so the modes a build refuses and the modes it composes are decided by one rule.

/** Display modes that need a surviving opener, which an isolated origin withholds from cross-origin hosts. */
export const WINDOWED_DISPLAY_MODES: readonly DisplayMode[] = [Modes.Popup, Modes.Standalone]

/**
 * Reports whether a declared isolation still permits the windowed display modes.
 *
 * A window opened onto a cross-origin isolated origin keeps its opener only
 * when the opener is same-origin and itself isolated. The object form of the
 * declaration names exactly that pairing; the bare COEP value declares
 * cross-origin reach, where the opener is always severed.
 *
 * @param isolation - The validated isolation declaration, or `undefined` when the feature declared none.
 * @returns `true` when a window opened onto this origin can keep its opener.
 *
 * @example Checking a cross-origin isolated feature
 * ```typescript
 * keepsWindowedModes('require-corp') // => false
 * keepsWindowedModes({ coep: 'require-corp', hosts: 'same-origin' }) // => true
 * ```
 */
export function keepsWindowedModes(isolation: FeatureIsolation | undefined): boolean {
  return isolation === undefined || typeof isolation !== 'string'
}
