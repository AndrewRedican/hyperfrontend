import type { Page } from 'playwright-core'
import { mediaError } from '../lib/media-error'
import { ExitCode } from '../models/exit-code'

// why: a page whose clock has been pinned answers a screenshot request an order of
// why: magnitude slower than a live one, well past the thirty seconds Playwright allows
// why: by default, and the request completes rather than hangs once it is given room
const CAPTURE_TIMEOUT_MS = 120_000

/** Which part of a page a still shows. */
export interface ShotFraming {
  /** Element to capture instead of the viewport. */
  selector?: string
  /** Whether to capture the full scrollable page rather than the viewport. */
  fullPage?: boolean
}

/**
 * Capture a still from a live page.
 *
 * A selector is the natural way to crop: it survives a layout change that
 * pixel offsets would not, and it says what the image is meant to show.
 *
 * @param page - The page to capture.
 * @param framing - Which part of the page to capture.
 * @returns The captured PNG.
 * @throws {Error} When the requested element is not on the page.
 */
export async function capturePng(page: Page, framing: ShotFraming): Promise<Buffer> {
  if (framing.selector === undefined) {
    return page.screenshot({ type: 'png', fullPage: framing.fullPage ?? false, timeout: CAPTURE_TIMEOUT_MS })
  }
  const element = await page.$(framing.selector)
  if (element === null) {
    throw mediaError(ExitCode.SceneFailed, `No element matches "${framing.selector}"`)
  }
  return element.screenshot({ type: 'png', timeout: CAPTURE_TIMEOUT_MS })
}
