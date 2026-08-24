import { delay } from '../lib/delay'
import { mediaError } from '../lib/media-error'
import { ExitCode } from '../models/exit-code'

/**
 * Poll a URL until something answers it.
 *
 * Any response at all counts, including a 404: the question is whether the
 * server is accepting connections, and a scene that then navigates to a
 * missing path fails later with a message about that path instead.
 *
 * @param url - The URL to poll.
 * @param timeoutMs - How long to keep trying.
 * @throws {Error} When nothing answers before the deadline.
 */
export async function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const deadline = performance.now() + timeoutMs
  while (performance.now() < deadline) {
    try {
      await fetch(url, { method: 'GET' })
      return
    } catch {
      await delay(200)
    }
  }
  throw mediaError(ExitCode.SceneFailed, `Nothing answered ${url} within ${timeoutMs}ms. Check the scene's serve command.`)
}
