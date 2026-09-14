import type { FetchLike } from './client'
import { describe, expect, it } from 'vitest'
import { createNpmClient } from './client'
import { NpmStatsError } from './model'

const PACKAGE = '@hyperfrontend/features'
const RANGE = { package: PACKAGE, start: '2026-09-01', end: '2026-09-02' }

/**
 * A canned response, JSON by default.
 *
 * @param body - What the body is, serialized when not already a string
 * @param status - HTTP status
 * @param contentType - Content type header
 * @returns The response
 */
function reply(body: unknown, status = 200, contentType = 'application/json; charset=utf-8'): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': contentType } })
}

/** A well-formed answer to {@link RANGE}. */
const GOOD_RANGE = {
  start: '2026-09-01',
  end: '2026-09-02',
  package: PACKAGE,
  downloads: [
    { downloads: 6, day: '2026-09-01' },
    { downloads: 0, day: '2026-09-02' },
  ],
}

/**
 * A transport that answers from a queue and records what it was asked.
 *
 * @param responses - Answers in order; a function throws in place of answering
 * @returns The transport and its log
 */
function queue(responses: Array<Response | (() => never)>): { fetch: FetchLike; urls: string[] } {
  const urls: string[] = []
  return {
    urls,
    fetch: (url) => {
      urls.push(url)
      const next = responses.shift()
      if (next === undefined) throw new Error(`unexpected request ${url}`)
      if (typeof next === 'function') next()
      return Promise.resolve(next as Response)
    },
  }
}

/**
 * A clock that records every wait instead of waiting.
 *
 * @returns The sleep function and the waits it was asked for
 */
function recordedSleep(): { sleep: (ms: number) => Promise<void>; waits: number[] } {
  const waits: number[] = []
  return {
    waits,
    sleep: (ms) => {
      waits.push(ms)
      return Promise.resolve()
    },
  }
}

/**
 * The failure kind a request rejects with, or null when it resolves.
 *
 * @param run - The request under test
 * @returns The failure's category, or null
 */
async function kindOf(run: Promise<unknown>): Promise<string | null> {
  try {
    await run
    return null
  } catch (error) {
    return error instanceof NpmStatsError ? error.kind : 'unexpected'
  }
}

describe('createNpmClient', () => {
  it('encodes a scoped package name the way npm expects', async () => {
    const transport = queue([reply(GOOD_RANGE)])
    await createNpmClient({ fetch: transport.fetch, sleep: recordedSleep().sleep }).fetchRange(RANGE)
    expect(transport.urls).toEqual(['https://api.npmjs.org/downloads/range/2026-09-01:2026-09-02/@hyperfrontend%2Ffeatures'])
  })

  it('returns validated daily records', async () => {
    const transport = queue([reply(GOOD_RANGE)])
    await expect(createNpmClient({ fetch: transport.fetch, sleep: recordedSleep().sleep }).fetchRange(RANGE)).resolves.toEqual([
      { package: PACKAGE, day: '2026-09-01', downloads: 6 },
      { package: PACKAGE, day: '2026-09-02', downloads: 0 },
    ])
  })

  it('waits the minimum gap after each completed request before the next', async () => {
    const transport = queue([reply(GOOD_RANGE), reply(GOOD_RANGE), reply(GOOD_RANGE)])
    const clock = recordedSleep()
    const client = createNpmClient({ fetch: transport.fetch, sleep: clock.sleep, minGapMs: 1000 })
    await client.fetchRange(RANGE)
    await client.fetchRange(RANGE)
    await client.fetchRange(RANGE)
    expect(clock.waits).toEqual([1000, 1000])
  })

  it('retries a server error with doubling backoff and then succeeds', async () => {
    const transport = queue([reply('down', 503, 'text/plain'), reply('down', 502, 'text/plain'), reply(GOOD_RANGE)])
    const clock = recordedSleep()
    const client = createNpmClient({ fetch: transport.fetch, sleep: clock.sleep, minGapMs: 1000, maxRetries: 3 })
    await client.fetchRange(RANGE)
    expect({ waits: clock.waits, requests: client.requestCount }).toEqual({ waits: [2000, 1000, 4000, 1000], requests: 3 })
  })

  it('retries a rate limit', async () => {
    const transport = queue([reply('slow down', 429, 'text/plain'), reply(GOOD_RANGE)])
    const client = createNpmClient({ fetch: transport.fetch, sleep: recordedSleep().sleep })
    await expect(client.fetchRange(RANGE)).resolves.toHaveLength(2)
  })

  it('gives up on a rate limit after the retry budget', async () => {
    const transport = queue([reply('', 429, 'text/plain'), reply('', 429, 'text/plain'), reply('', 429, 'text/plain')])
    const client = createNpmClient({ fetch: transport.fetch, sleep: recordedSleep().sleep, maxRetries: 2 })
    await expect(kindOf(client.fetchRange(RANGE))).resolves.toBe('rate-limited')
  })

  it('retries a network failure', async () => {
    const transport = queue([
      () => {
        throw new Error('ECONNRESET')
      },
      reply(GOOD_RANGE),
    ])
    const client = createNpmClient({ fetch: transport.fetch, sleep: recordedSleep().sleep })
    await expect(client.fetchRange(RANGE)).resolves.toHaveLength(2)
  })

  it('does not retry a missing package', async () => {
    const transport = queue([reply({ error: 'package not found' }, 404)])
    const client = createNpmClient({ fetch: transport.fetch, sleep: recordedSleep().sleep })
    await expect(kindOf(client.fetchRange(RANGE))).resolves.toBe('package-not-found')
  })

  it('reports a missing package with the request URL', async () => {
    const transport = queue([reply({ error: 'package not found' }, 404)])
    const client = createNpmClient({ fetch: transport.fetch, sleep: recordedSleep().sleep })
    await expect(client.fetchRange(RANGE)).rejects.toThrow('@hyperfrontend%2Ffeatures')
  })

  it('does not retry a rejected request', async () => {
    const transport = queue([reply({ error: 'bad period' }, 400)])
    const client = createNpmClient({ fetch: transport.fetch, sleep: recordedSleep().sleep })
    await expect(kindOf(client.fetchRange(RANGE))).resolves.toBe('request-rejected')
  })

  it('rejects a non-JSON content type as schema drift', async () => {
    const transport = queue([reply('<html>', 200, 'text/html')])
    const client = createNpmClient({ fetch: transport.fetch, sleep: recordedSleep().sleep })
    await expect(kindOf(client.fetchRange(RANGE))).resolves.toBe('schema-drift')
  })

  it('reports unreadable JSON as malformed', async () => {
    const transport = queue([reply('{"start":', 200)])
    const client = createNpmClient({ fetch: transport.fetch, sleep: recordedSleep().sleep })
    await expect(kindOf(client.fetchRange(RANGE))).resolves.toBe('malformed-json')
  })

  it('surfaces a truncated range from the validator', async () => {
    const transport = queue([reply({ ...GOOD_RANGE, start: '2026-09-02', downloads: GOOD_RANGE.downloads.slice(1) })])
    const client = createNpmClient({ fetch: transport.fetch, sleep: recordedSleep().sleep })
    await expect(kindOf(client.fetchRange(RANGE))).resolves.toBe('truncated-range')
  })

  it('asks the point endpoint for the newest counted day', async () => {
    const transport = queue([reply({ downloads: 11, start: '2026-09-10', end: '2026-09-10', package: PACKAGE })])
    const client = createNpmClient({ fetch: transport.fetch, sleep: recordedSleep().sleep })
    await expect(client.fetchLastDay(PACKAGE)).resolves.toBe('2026-09-10')
  })

  it('asks the registry for the creation day', async () => {
    const transport = queue([reply({ name: PACKAGE, time: { created: '2026-06-28T13:22:06.094Z' } })])
    const client = createNpmClient({ fetch: transport.fetch, sleep: recordedSleep().sleep })
    await client.fetchCreated(PACKAGE)
    expect(transport.urls).toEqual(['https://registry.npmjs.org/@hyperfrontend%2Ffeatures'])
  })

  it('narrates retries to whoever is watching', async () => {
    const transport = queue([reply('down', 503, 'text/plain'), reply(GOOD_RANGE)])
    const lines: string[] = []
    const client = createNpmClient({ fetch: transport.fetch, sleep: recordedSleep().sleep, onProgress: (line) => lines.push(line) })
    await client.fetchRange(RANGE)
    expect(lines).toEqual([expect.stringContaining('2026-09-01:2026-09-02'), expect.stringContaining('retrying in 2000ms (1/3)')])
  })
})
