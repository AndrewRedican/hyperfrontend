import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

// note: Absolute fallback dialog/popup footprint, used only when no viewport is measurable.
const FALLBACK_WIDTH = 530
const FALLBACK_HEIGHT = 550

// note: Hardcoded knobs the dynamic size derives from — viewport-height coverage, width-to-height aspect ratio, and the max fraction of either axis before shrink-to-fit.
const SIZE_CONFIG = freeze(<const>{
  coverage: 0.6,
  aspectRatio: FALLBACK_WIDTH / FALLBACK_HEIGHT,
  maxCoverage: 0.9,
})

/**
 * Viewport-derived default footprint for the dialog and popup display modes.
 */
export interface DialogSizeDefaults {
  /** Default width in pixels for the current viewport. */
  readonly width: number
  /** Default height in pixels for the current viewport. */
  readonly height: number
}

/**
 * Computes the dialog footprint for the current viewport.
 *
 * Targets `coverage` of the viewport height, derives the width from the aspect
 * ratio, then shrinks both to honor `maxCoverage` of the viewport width.
 *
 * @returns The resolved width and height in pixels, or the fixed fallback when
 * no viewport is measurable.
 */
function resolveDialogSize(): DialogSizeDefaults {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  if (!viewportWidth || !viewportHeight) {
    return { width: FALLBACK_WIDTH, height: FALLBACK_HEIGHT }
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
 * Dynamic default size for dialog and popup modes, recomputed on each access
 * from the live viewport. Per-open `dialogWidth`/`dialogHeight` take precedence.
 */
export const dialogDefaults: DialogSizeDefaults = freeze(<DialogSizeDefaults>{
  get width() {
    return resolveDialogSize().width
  },
  get height() {
    return resolveDialogSize().height
  },
})
