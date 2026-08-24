import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { mediaError } from '../lib/media-error'
import { ExitCode } from '../models/exit-code'

/** Executable paths inside a cached Chromium download, one per platform. */
const CACHED_EXECUTABLES: readonly string[] = [
  join('chrome-linux64', 'chrome'),
  join('chrome-linux', 'chrome'),
  join('chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
  join('chrome-win', 'chrome.exe'),
]

/**
 * Find a cached full Chromium build.
 *
 * Only directories named `chromium-` are considered, which deliberately
 * excludes `chromium_headless_shell-`: the shell carries no GPU stack, so a
 * scene with a WebGL canvas records an empty frame in it and nothing says why.
 *
 * @returns An absolute path, or an empty string when no cached build exists.
 */
function findCachedChromium(): string {
  const cacheRoot = process.env['PLAYWRIGHT_BROWSERS_PATH'] ?? join(homedir(), '.cache', 'ms-playwright')
  if (!existsSync(cacheRoot)) {
    return ''
  }
  for (const entry of readdirSync(cacheRoot).sort().reverse()) {
    if (!entry.startsWith('chromium-')) {
      continue
    }
    for (const relative of CACHED_EXECUTABLES) {
      const candidate = join(cacheRoot, entry, relative)
      if (existsSync(candidate)) {
        return candidate
      }
    }
  }
  return ''
}

/**
 * Decide which browser binary to launch.
 *
 * A configured path wins, then whatever the driver knows about, then the
 * newest cached download. The cached build is worth reaching for because the
 * driver's own answer goes stale as soon as its version moves ahead of the
 * download, and the resulting failure names a path rather than a fix.
 *
 * @param configured - Executable a workspace pinned, or an empty string.
 * @returns An absolute path to a browser binary.
 * @throws {Error} When no browser can be found.
 */
export function resolveChromium(configured: string): string {
  if (configured !== '' && existsSync(configured)) {
    return configured
  }
  const fromDriver = chromium.executablePath()
  if (fromDriver !== '' && existsSync(fromDriver)) {
    return fromDriver
  }
  const cached = findCachedChromium()
  if (cached !== '') {
    return cached
  }
  throw mediaError(
    ExitCode.ToolchainMissing,
    'No Chromium build found. Run `npx playwright install chromium`, or set browser.executablePath in the media config.'
  )
}
