import type { Page } from 'playwright-core'
import { STAGE_ELEMENT_ID } from './document'

/** The markup for one instant, and where in the page it is mounted. */
interface StageMount {
  /** Id of the element the stage draws into. */
  elementId: string
  /** Markup for the instant being shown. */
  markup: string
}

/**
 * Show one instant of a stage on an already mounted page.
 *
 * The markup is replaced wholesale rather than patched, so nothing a browser
 * would carry between two states of the same element (a transition, a caret's
 * blink phase, a scroll position) survives from one frame to the next. That is
 * what makes a frame a function of its moment alone.
 *
 * @param page - The page the stage document is loaded on.
 * @param markup - The stage's markup for the instant being shown.
 */
export async function mountFrame(page: Page, markup: string): Promise<void> {
  await page.evaluate(
    (mount: StageMount) => {
      const host = document.getElementById(mount.elementId)
      if (host !== null) {
        host.innerHTML = mount.markup
      }
    },
    { elementId: STAGE_ELEMENT_ID, markup }
  )
}
