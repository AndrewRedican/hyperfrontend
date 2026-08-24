import type { Page } from 'playwright-core'
import type { ConsoleRecord } from '../models/report'
import type { SceneAssertions } from '../models/scene'
import { mediaError } from '../lib/media-error'
import { ExitCode } from '../models/exit-code'

/**
 * Check a ready page against what the scene said it should look like.
 *
 * Run after the readiness gate and before anything is encoded, because the
 * cost of a wrong frame is a committed asset that nobody notices is wrong
 * until it is on a package page.
 *
 * @param page - The ready page.
 * @param assertions - What the scene requires.
 * @param consoleRecord - What the page has said for itself so far.
 * @throws {Error} When the page does not satisfy the scene.
 */
export async function assertScene(page: Page, assertions: SceneAssertions | undefined, consoleRecord: ConsoleRecord): Promise<void> {
  if (assertions === undefined) {
    return
  }
  const tolerated = assertions.maxConsoleErrors
  if (tolerated !== undefined && consoleRecord.errors + consoleRecord.pageErrors > tolerated) {
    throw mediaError(
      ExitCode.SceneFailed,
      `The page reported ${consoleRecord.errors} console errors and ${consoleRecord.pageErrors} page errors, above the ${tolerated} allowed.`
    )
  }
  for (const expectation of assertions.expect ?? []) {
    const actual = await page.locator(expectation.selector).count()
    if (actual !== expectation.count) {
      throw mediaError(ExitCode.SceneFailed, `Expected ${expectation.count} elements matching "${expectation.selector}", found ${actual}.`)
    }
  }
}
