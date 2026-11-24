import type { RunningStatistics } from './__test-utils__/run-statistics'
import type { DownloadsAnswer } from './downloads'
import { after, before } from 'node:test'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it, waitUntil } from '@hyperfrontend/testing'
import config from '../service.config'
import { createFakeNpm } from './__test-utils__/fake-npm'
import { refuseStatistics, runStatistics, SITE, whileRunning } from './__test-utils__/run-statistics'

/** How many packages the service is built to track. */
const TRACKED = config.immutable.packages.length

/**
 * Wait for the service to write a line of its own.
 *
 * @param running - The service whose lines are read
 * @param start - What the line begins with
 * @param from - The index of the first line considered, so a spec can wait for the next line of a kind
 * @returns The first such line, once the service has written it
 */
function lineOf(running: RunningStatistics, start: string, from = 0): Promise<string> {
  return waitUntil(() => running.lines.slice(from).find((line) => line.startsWith(start)), { timeout: 10000, interval: 5 })
}

describe('service-statistics, once it has collected', () => {
  const npm = createFakeNpm('2026-09-11')
  let running: RunningStatistics

  before(async () => {
    running = await runStatistics(npm)
    await lineOf(running, 'collection outcome=collected')
  })

  after(async () => {
    await running.stop()
  })

  it('writes one line for the first collection, counting a probe and two requests for each package', () => {
    expect(running.lines[0]).toBe(
      `collection outcome=collected frontier=2026-09-11 packages=${TRACKED} pending=0 requests=${1 + 2 * TRACKED}\n`
    )
  })

  it('answers the history of every tracked package', async () => {
    const answer = (await (await fetch(new URL('/v1/downloads', running.origin))).json()) as DownloadsAnswer
    expect({ frontier: answer.frontier, packages: answer.packages.map((entry) => entry.package) }).toEqual({
      frontier: '2026-09-11',
      packages: config.immutable.packages,
    })
  })

  it('answers the days on and after the day asked for', async () => {
    const answer = (await (await fetch(new URL('/v1/downloads?since=2026-09-10', running.origin))).json()) as DownloadsAnswer
    expect(answer.packages[0].days).toEqual([
      { day: '2026-09-10', downloads: 10 },
      { day: '2026-09-11', downloads: 11 },
    ])
  })

  it('refuses a since that is no calendar day', async () => {
    expect((await fetch(new URL('/v1/downloads?since=today', running.origin))).status).toBe(400)
  })

  it('lets the site read an answer from a browser', async () => {
    const response = await fetch(new URL('/v1/downloads', running.origin), { headers: { Origin: SITE } })
    expect(response.headers.get('access-control-allow-origin')).toBe(SITE)
  })

  it('grants no other origin', async () => {
    const response = await fetch(new URL('/v1/downloads', running.origin), { headers: { Origin: 'https://elsewhere.example' } })
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('answers the health probe', async () => {
    expect(await (await fetch(new URL('/healthz', running.origin))).text()).toBe('ok')
  })

  it('answers the readiness probe as ready', async () => {
    expect((await fetch(new URL('/readyz', running.origin))).status).toBe(200)
  })

  it('finds on its next turn that npm has counted no new day, with one request', async () => {
    expect(await lineOf(running, 'collection outcome=unchanged')).toBe(
      `collection outcome=unchanged frontier=2026-09-11 packages=${TRACKED} pending=0 requests=1\n`
    )
  })
})

describe('service-statistics, over time', () => {
  it('collects the new day once npm has counted it, with a probe and one request for each package', async () => {
    const npm = createFakeNpm('2026-09-11')
    const line = await whileRunning(npm, {}, async (running) => {
      await lineOf(running, 'collection outcome=collected')
      npm.frontier = '2026-09-12'
      return lineOf(running, 'collection outcome=collected', 1)
    })
    expect(line).toBe(`collection outcome=collected frontier=2026-09-12 packages=${TRACKED} pending=0 requests=${1 + TRACKED}\n`)
  })

  it('logs a collection npm failed and says what kind of failure it was', async () => {
    const npm = createFakeNpm('2026-09-11')
    npm.mode = 'failing'
    const line = await whileRunning(npm, {}, (running) => lineOf(running, 'collection outcome=failed'))
    expect(line).toMatch(/^collection outcome=failed kind=unavailable requests=4\n {2}NpmStatsError: npm answered .+ with HTTP 503 .+\n$/)
  })

  it('writes a failed collection to standard error', async () => {
    const npm = createFakeNpm('2026-09-11')
    npm.mode = 'failing'
    const errors = await whileRunning(npm, {}, async (running) => {
      await lineOf(running, 'collection outcome=failed')
      return [...running.errors]
    })
    expect(errors[0]).toContain('collection outcome=failed kind=unavailable')
  })

  it('keeps the turns that found nothing new out of its output unless it is asked for them', async () => {
    const npm = createFakeNpm('2026-09-11')
    const lines = await whileRunning(npm, { env: { STATISTICS_LOG_LEVEL: undefined } }, async (running) => {
      await lineOf(running, 'collection outcome=collected')
      const probes = npm.urls.length
      // why: three further requests are three further turns, each of which found nothing new
      await waitUntil(() => npm.urls.length >= probes + 3, { timeout: 10000, interval: 5 })
      return [...running.lines]
    })
    expect(lines).toEqual([expect.stringContaining('collection outcome=collected')])
  })

  it('collects on a later turn after a collection that failed', async () => {
    const npm = createFakeNpm('2026-09-11')
    npm.mode = 'failing'
    const line = await whileRunning(npm, {}, async (running) => {
      await lineOf(running, 'collection outcome=failed')
      npm.mode = 'answering'
      return lineOf(running, 'collection outcome=collected')
    })
    expect(line).toContain('frontier=2026-09-11')
  })

  it('logs a failure the collector did not classify as a fault', async () => {
    const now = (): number => {
      throw createError('the clock stopped')
    }
    const line = await whileRunning(createFakeNpm('2026-09-11'), { now }, (running) => lineOf(running, 'collection outcome=failed'))
    expect(line).toBe('collection outcome=failed kind=fault requests=0\n  Error: the clock stopped\n')
  })
})

describe('service-statistics, before its first collection has finished', () => {
  const npm = createFakeNpm('2026-09-11')
  let running: RunningStatistics

  before(async () => {
    npm.mode = 'silent'
    running = await runStatistics(npm)
    await waitUntil(() => npm.urls.length > 0, { timeout: 10000, interval: 5 })
  })

  after(async () => {
    // why: the last test of the group stops the service, and this stops it when that test was never reached
    await running.stop()
  })

  it('answers the history route with 503 and a time to ask again', async () => {
    const response = await fetch(new URL('/v1/downloads', running.origin))
    expect({ status: response.status, retryAfter: response.headers.get('retry-after') }).toEqual({ status: 503, retryAfter: '30' })
  })

  it('answers the readiness probe as not ready', async () => {
    expect((await fetch(new URL('/readyz', running.origin))).status).toBe(503)
  })

  it('answers the health probe all the same', async () => {
    expect((await fetch(new URL('/healthz', running.origin))).status).toBe(200)
  })

  it('exits with code 0 when it is asked to stop with a collection in flight', async () => {
    expect(await running.stop()).toBe(0)
  })

  it('writes no line for the collection the stop cut short', () => {
    expect(running.lines).toEqual([])
  })
})

describe('service-statistics, started with an environment it cannot run in', () => {
  it('exits with code 78 when no site is allowed to read it', async () => {
    const refused = await refuseStatistics(createFakeNpm('2026-09-11'), { env: { STATISTICS_ALLOWED_ORIGINS: undefined } })
    expect(refused.exitCode).toBe(78)
  })

  it('names the variable it is missing', async () => {
    const refused = await refuseStatistics(createFakeNpm('2026-09-11'), { env: { STATISTICS_ALLOWED_ORIGINS: undefined } })
    expect(refused.output).toContain('STATISTICS_ALLOWED_ORIGINS (site) is missing; expected a comma-separated list of origins')
  })

  it('refuses a log level the logging package does not have', async () => {
    const refused = await refuseStatistics(createFakeNpm('2026-09-11'), { env: { STATISTICS_LOG_LEVEL: 'verbose' } })
    expect(refused.output).toContain('STATISTICS_LOG_LEVEL (log) is malformed; expected one of none, error, warn, log, info and debug')
  })

  it('refuses a collection interval written without a unit', async () => {
    const refused = await refuseStatistics(createFakeNpm('2026-09-11'), { env: { STATISTICS_COLLECT_EVERY: '60' } })
    expect(refused.exitCode).toBe(78)
  })
})
