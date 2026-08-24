import type { Browser } from 'playwright-core'
import type { BrowserConfig } from '../models/config'
import { chromium } from 'playwright-core'
import { resolveChromium } from './resolve-chromium'

/** Flags every launch needs, whatever the workspace adds on top. */
const BASE_ARGS: readonly string[] = ['--no-sandbox', '--disable-dev-shm-usage']

/** A launched browser paired with the build it came from. */
export interface LaunchedBrowser {
  /** The running browser. */
  browser: Browser
  /** Executable that was launched. */
  executablePath: string
}

/**
 * Launch Chromium with an explicitly resolved executable.
 *
 * The path is always passed rather than left to the driver, so a mismatch
 * between the driver and the cached download fails at resolution with a
 * message naming the install command instead of deep inside a launch.
 *
 * @param config - The workspace's browser settings.
 * @returns The running browser and the build it came from.
 */
export async function launchBrowser(config: BrowserConfig): Promise<LaunchedBrowser> {
  const executablePath = resolveChromium(config.executablePath)
  return {
    browser: await chromium.launch({ executablePath, args: [...BASE_ARGS, ...config.args] }),
    executablePath,
  }
}
