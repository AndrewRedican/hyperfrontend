import type { OpenSession } from '../browser/session'
import type { RecordWindow } from '../models/capture'
import type { Choreography, StillSpec } from '../models/scene'
import { delay } from '../lib/delay'
import { mediaError } from '../lib/media-error'
import { ExitCode } from '../models/exit-code'
import { capturePng } from './screenshot'

/** A still captured mid-recording, held until the encoder decides where it goes. */
export interface CapturedStill {
  /** The still as declared on the scene. */
  spec: StillSpec
  /** The captured PNG. */
  png: Buffer
}

/** The finished recording and where inside it the interesting part sits. */
export interface RecordedVideo {
  /** Absolute path of the recorded video. */
  path: string
  /** Offset into the video where the kept animation starts. */
  startMs: number
  /** Length of the kept animation. */
  durationMs: number
  /** Stills captured while the window was open. */
  stills: readonly CapturedStill[]
}

/**
 * Hold a ready page for the length of the record window, then close it.
 *
 * Video capture starts when the browser context opens, so a page with a long
 * boot always has that boot at the head of the file. Rather than try to start
 * capture later, this records the offset at which the window opened and hands
 * it to the encoder to trim, which is exact and needs no cooperation from the
 * browser.
 *
 * @param session - The open, ready page.
 * @param window - How long to settle and how long to keep.
 * @param stills - Stills to capture inside the window.
 * @param choreograph - Interaction to drive while the window is open.
 * @returns The recording, and where inside it the kept animation sits.
 * @throws {Error} When the browser produced no video file.
 */
export async function recordWindow(
  session: OpenSession,
  window: RecordWindow,
  stills: readonly StillSpec[],
  choreograph: Choreography | undefined
): Promise<RecordedVideo> {
  await delay(window.settleMs)
  const startMs = performance.now() - session.openedAtMs
  const video = session.page.video()
  const captured: CapturedStill[] = []

  const interaction = choreograph === undefined ? undefined : choreograph(session.page)
  let elapsed = 0
  for (const spec of [...stills].sort((left, right) => left.atMs - right.atMs)) {
    if (spec.atMs > window.durationMs) {
      continue
    }
    await delay(spec.atMs - elapsed)
    elapsed = spec.atMs
    captured.push({ spec, png: await capturePng(session.page, spec) })
  }
  await delay(window.durationMs - elapsed)
  await interaction

  await session.context.close()
  const path = await video?.path()
  if (path === undefined) {
    throw mediaError(ExitCode.SceneFailed, 'The browser produced no video file. Check that the scene declares a gif output.')
  }
  return { path, startMs, durationMs: window.durationMs, stills: captured }
}
