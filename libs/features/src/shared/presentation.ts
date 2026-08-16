import type { BoxPosition, DismissSource, DisplayMode } from './types'
import { max, min, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

// note: Payload shapes that cross the boundary plus the size/position formulas both SDK sides resolve with. Every dimension that crosses is a resolved pixel number, never a relative unit.

/**
 * Agreed inner dialog box geometry carried by a dialog-mode presentation
 * announcement; absent dimensions fall back to viewport-derived sizing on the
 * feature side.
 */
export interface DialogBoxSize {
  /** Inner dialog box width in pixels, when configured. */
  width?: number
  /** Inner dialog box height in pixels, when configured. */
  height?: number
  /** Where the inner box sits inside the pane; defaults to `center`. */
  position?: BoxPosition
}

/**
 * Payload of the reserved present control message the host sends once per
 * mount: the display mode this mount uses, the frame's initial dimensions,
 * and the agreed inner dialog box geometry when the mode is `dialog`.
 */
export interface PresentPayload {
  /** The display mode the host mounted the feature in. */
  mode: DisplayMode
  /**
   * The frame's usable space at mount time, in exact pixels (iframe modes
   * only), so the feature can lay itself out without waiting for the first
   * viewport report; later changes arrive as viewport reports.
   */
  viewport?: ViewportPayload
  /** Agreed inner dialog box geometry (dialog mode only). */
  dialog?: DialogBoxSize
}

/**
 * Payload of the reserved viewport control message: the exact pixel dimensions
 * of the space the feature's frame occupies, reported by the host whenever the
 * measured space changes (iframe modes only).
 */
export interface ViewportPayload {
  /** Usable width in pixels. */
  width: number
  /** Usable height in pixels. */
  height: number
}

/**
 * Payload of the reserved dismiss control message the feature sends from
 * dialog mode: where the dismiss interaction originated.
 */
export interface DismissPayload {
  /** The interaction that triggered the signal. */
  source: DismissSource
}

// note: Absolute last-resort footprint, used only when no viewport is measurable.
const ABSOLUTE_FALLBACK_WIDTH = 530
const ABSOLUTE_FALLBACK_HEIGHT = 550

// note: Hardcoded knobs the dialog/popup dynamic size derives from — viewport-height coverage, width-to-height aspect ratio, and the max fraction of either axis before shrink-to-fit.
const SIZE_CONFIG = freeze(<const>{
  coverage: 0.6,
  aspectRatio: ABSOLUTE_FALLBACK_WIDTH / ABSOLUTE_FALLBACK_HEIGHT,
  maxCoverage: 0.9,
})

/**
 * A resolved width/height pair in pixels.
 */
export interface ResolvedSize {
  /** Resolved width in pixels. */
  readonly width: number
  /** Resolved height in pixels. */
  readonly height: number
}

/**
 * Computes the dialog/popup footprint for a viewport.
 *
 * Targets `coverage` of the viewport height, derives the width from the aspect
 * ratio, then shrinks both to honor `maxCoverage` of the viewport width. Used
 * by the host for popup window defaults and by the hostee for inner dialog box
 * defaults: both sides measure the same viewport, so they agree.
 *
 * @param viewportWidth - The viewport width in pixels.
 * @param viewportHeight - The viewport height in pixels.
 * @returns The resolved width and height in pixels, or the absolute fallback
 * when the viewport is not measurable.
 *
 * @example Sizing a dialog box from the frame's viewport
 * ```typescript
 * const { width, height } = resolveDynamicSize(window.innerWidth, window.innerHeight)
 * ```
 */
export function resolveDynamicSize(viewportWidth: number, viewportHeight: number): ResolvedSize {
  if (!viewportWidth || !viewportHeight) {
    return { width: ABSOLUTE_FALLBACK_WIDTH, height: ABSOLUTE_FALLBACK_HEIGHT }
  }
  let height = viewportHeight * SIZE_CONFIG.coverage
  let width = height * SIZE_CONFIG.aspectRatio
  const maxWidth = viewportWidth * SIZE_CONFIG.maxCoverage
  if (width > maxWidth) {
    width = maxWidth
    height = width / SIZE_CONFIG.aspectRatio
  }
  return { width: round(width), height: round(height) }
}

/**
 * A box position resolved into one alignment per axis, ready for flex
 * alignment (dialog box) or offset math (popup window).
 */
export interface ResolvedPosition {
  /** Vertical alignment inside the available area. */
  readonly vertical: 'start' | 'center' | 'end'
  /** Horizontal alignment inside the available area. */
  readonly horizontal: 'start' | 'center' | 'end'
}

// note: Compound-value lookup; the bare 'center' shorthand resolves before it.
const POSITION_AXES = freeze(<Record<Exclude<BoxPosition, 'center'>, ResolvedPosition>>{
  'top-left': { vertical: 'start', horizontal: 'start' },
  'top-center': { vertical: 'start', horizontal: 'center' },
  'top-right': { vertical: 'start', horizontal: 'end' },
  'center-left': { vertical: 'center', horizontal: 'start' },
  'center-right': { vertical: 'center', horizontal: 'end' },
  'bottom-left': { vertical: 'end', horizontal: 'start' },
  'bottom-center': { vertical: 'end', horizontal: 'center' },
  'bottom-right': { vertical: 'end', horizontal: 'end' },
})

/**
 * Resolves a box position into its per-axis alignments.
 *
 * @param position - The configured position; absent means `center`.
 * @returns The vertical and horizontal alignments.
 *
 * @example Resolving the default
 * ```typescript
 * resolveBoxPosition(undefined) // { vertical: 'center', horizontal: 'center' }
 * ```
 */
export function resolveBoxPosition(position: BoxPosition | undefined): ResolvedPosition {
  if (position === undefined || position === 'center') {
    return { vertical: 'center', horizontal: 'center' }
  }
  return POSITION_AXES[position]
}

/**
 * Computes the offset of a box aligned inside a larger extent.
 *
 * @param alignment - The resolved alignment on this axis.
 * @param extent - The available extent in pixels (screen or area size).
 * @param size - The box size in pixels on this axis.
 * @returns The rounded offset from the start of the extent, never negative.
 *
 * @example Centering a 500px window on a 1920px screen
 * ```typescript
 * alignOffset('center', 1920, 500) // 710
 * ```
 */
export function alignOffset(alignment: ResolvedPosition['vertical'], extent: number, size: number): number {
  if (alignment === 'start') {
    return 0
  }
  const free = max(extent - size, 0)
  return alignment === 'center' ? round(free / 2) : round(free)
}

/**
 * Computes best-effort embedded dimensions for a container that has no
 * measurable size yet.
 *
 * Keeps any real measured width, fills a missing width from the viewport, and
 * derives the height from the viewport's own aspect ratio (capped at
 * `maxCoverage` of the viewport height), a dynamic estimate rather than an
 * arbitrary fixed value.
 *
 * @param measuredWidth - The container's measured content-box width, `0` when unmeasurable.
 * @param viewportWidth - The host viewport width in pixels.
 * @param viewportHeight - The host viewport height in pixels.
 * @returns The fallback width and height in pixels.
 *
 * @example Falling back for a not-yet-laid-out container
 * ```typescript
 * const size = resolveEmbedFallback(0, window.innerWidth, window.innerHeight)
 * ```
 */
export function resolveEmbedFallback(measuredWidth: number, viewportWidth: number, viewportHeight: number): ResolvedSize {
  if (!viewportWidth || !viewportHeight) {
    return { width: measuredWidth || ABSOLUTE_FALLBACK_WIDTH, height: ABSOLUTE_FALLBACK_HEIGHT }
  }
  const width = measuredWidth || round(viewportWidth)
  const height = round(min(width * (viewportHeight / viewportWidth), viewportHeight * SIZE_CONFIG.maxCoverage))
  return { width, height }
}
