import type { ResolvedMediaConfig } from '../../models/config'
import { existsSync } from 'node:fs'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { resolveChromium } from '../../browser/resolve-chromium'
import { findBundledFfmpeg, readVersion } from '../../encode/binaries'

/** What the doctor found for one prerequisite. */
interface Finding {
  /** What was looked for. */
  name: string
  /** What was found, or an empty string when it is missing. */
  detail: string
  /** What to run when it is missing. */
  fix: string
}

/**
 * Look for a browser without letting a missing one end the report.
 *
 * @param configured - Executable a workspace pinned, or an empty string.
 * @returns What was found, or an empty string.
 */
function findChromium(configured: string): string {
  try {
    return resolveChromium(configured)
  } catch {
    return ''
  }
}

/**
 * Report which browsers and encoders this machine can offer.
 *
 * Written to be the first thing anyone runs on a new machine: every missing
 * prerequisite is printed with the command that installs it, rather than
 * surfacing later as a failure part-way through a recording.
 *
 * @param config - The workspace configuration.
 * @param asJson - Whether to print machine-readable output.
 * @returns The report, ready to print.
 */
export function runDoctor(config: ResolvedMediaConfig, asJson: boolean): string {
  const chromium = findChromium(config.browser.executablePath)
  const bundledFfmpeg = findBundledFfmpeg()
  const findings: readonly Finding[] = [
    { name: 'chromium', detail: chromium, fix: 'npx playwright install chromium' },
    { name: 'ffmpeg', detail: readVersion(config.encoder.binaries.ffmpeg, '-version'), fix: 'apt-get install ffmpeg' },
    { name: 'gifsicle', detail: readVersion(config.encoder.binaries.gifsicle, '--version'), fix: 'apt-get install gifsicle' },
    { name: 'bundled ffmpeg', detail: existsSync(bundledFfmpeg) ? bundledFfmpeg : '', fix: 'npx playwright install chromium' },
  ]
  if (asJson) {
    return stringify({ findings }, undefined, 2)
  }
  return findings
    .map(
      (finding) =>
        `${finding.detail === '' ? 'missing' : 'ok     '}  ${finding.name.padEnd(16)}${finding.detail === '' ? finding.fix : finding.detail}`
    )
    .join('\n')
}
