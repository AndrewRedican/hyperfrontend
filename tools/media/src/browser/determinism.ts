import type { Page } from 'playwright-core'
import type { Determinism } from '../models/capture'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/**
 * Build the init script that pins what `navigator` reports.
 *
 * Written as source text rather than a function reference because this code
 * runs in the page, not here, and passing it as text keeps the two worlds from
 * being confused for each other.
 *
 * @param overrides - Property values the page should report.
 * @returns A script to run before any page script.
 */
function navigatorScript(overrides: Record<string, unknown>): string {
  return `
    const overrides = ${stringify(overrides)};
    for (const key of Object.keys(overrides)) {
      Object.defineProperty(navigator, key, { get: () => overrides[key], configurable: true });
    }
  `
}

/**
 * Pin everything about a page that would otherwise vary by machine or by hour.
 *
 * The clock is installed and then immediately resumed. Installing alone pins
 * the date but leaves time frozen, which stalls any animation whose frame delta
 * comes from the clock and blocks screenshots on a page that waits for web
 * fonts. Resuming keeps the pinned date and lets time run again.
 *
 * @param page - The page to pin, before it has navigated anywhere.
 * @param determinism - What the scene asked to pin.
 */
export async function applyDeterminism(page: Page, determinism: Determinism | undefined): Promise<void> {
  if (determinism === undefined) {
    return
  }
  if (determinism.clock !== undefined) {
    await page.clock.install({ time: createDate(determinism.clock.time) })
    if (determinism.clock.resume) {
      await page.clock.resume()
    }
  }
  if (determinism.navigator !== undefined) {
    await page.addInitScript({ content: navigatorScript({ ...determinism.navigator }) })
  }
}
