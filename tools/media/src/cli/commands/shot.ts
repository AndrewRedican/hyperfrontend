import type { ResolvedMediaConfig } from '../../models/config'
import type { ParsedArgs } from '../args'
import { writeFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { launchBrowser } from '../../browser/launch'
import { openSession } from '../../browser/session'
import { capturePng } from '../../capture/screenshot'
import { writeStill } from '../../encode/still'
import { delay } from '../../lib/delay'
import { formatBytes } from '../../lib/format-bytes'
import { mediaError } from '../../lib/media-error'
import { ExitCode } from '../../models/exit-code'
import { readNumber, readSize, readString } from '../args'

/** Still formats the ad-hoc command accepts. */
const FORMATS: readonly string[] = ['png', 'webp', 'jpeg']

/**
 * Take one screenshot of one page, with no scene file involved.
 *
 * This is the debugging path rather than the asset path: it writes wherever it
 * is told, is never budgeted, and can dump the page's console output beside
 * the image so a render that came out wrong explains itself.
 *
 * @param config - The workspace configuration, used only for browser settings.
 * @param args - The parsed command line.
 * @returns A line describing what was written.
 * @throws {Error} When required options are missing or the page never settles.
 */
export async function runShot(config: ResolvedMediaConfig, args: ParsedArgs): Promise<string> {
  const url = readString(args, 'url', '')
  const out = readString(args, 'out', '')
  if (url === '' || out === '') {
    throw mediaError(ExitCode.Usage, 'shot needs both --url and --out')
  }
  const format = readString(args, 'format', extname(out).slice(1) || 'png')
  if (!FORMATS.includes(format)) {
    throw mediaError(ExitCode.Usage, `--format must be one of ${FORMATS.join(', ')}`)
  }
  const [width, height] = readSize(readString(args, 'viewport', '1280x800'))
  const waitFor = readString(args, 'wait', '')
  const outputPath = resolve(out)

  const launched = await launchBrowser(config.browser)
  try {
    const session = await openSession(launched.browser, {
      viewport: { width, height },
      videoDir: '',
      url,
      ...(waitFor === '' ? {} : { ready: { selector: waitFor, timeoutMs: readNumber(args, 'timeout', 60_000) } }),
      readyTimeoutMs: config.browser.readyTimeoutMs,
    })
    await delay(readNumber(args, 'settle', 0))
    const selector = readString(args, 'selector', '')
    const png = await capturePng(session.page, {
      ...(selector === '' ? {} : { selector }),
      fullPage: args.flags.has('full-page'),
    })
    const bytes = await writeStill(png, outputPath, {
      format: <'png' | 'webp' | 'jpeg'>format,
      quality: readNumber(args, 'quality', 90),
      width: readNumber(args, 'width', 0),
    })
    if (args.flags.has('console')) {
      writeFileSync(
        `${outputPath}.log.json`,
        `${stringify({ url, viewport: { width, height }, messages: session.messages }, undefined, 2)}\n`
      )
    }
    await session.context.close()
    return `${outputPath}  ${formatBytes(bytes)}  ${session.consoleRecord.errors} console errors`
  } finally {
    await launched.browser.close()
  }
}
