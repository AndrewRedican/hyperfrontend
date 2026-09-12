import type { Day } from './dates'
import type { DailyDownloads } from './model'
import type { RangeRequest } from './validate'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { DOWNLOADS_API, MAX_RETRIES, MIN_REQUEST_GAP_MS, NpmStatsError, REGISTRY_API, TRANSIENT_FAILURES } from './model'
import { validateCreatedResponse, validateLastDayResponse, validateRangeResponse } from './validate'

/** The subset of `fetch` the client needs, so a test can hand it canned responses. */
export type FetchLike = (url: string) => Promise<Response>

/** How the client waits, so a test can skip the waiting. */
export type SleepLike = (ms: number) => Promise<void>

/** What the client is built from. */
export interface NpmClientOptions {
  /** The transport; defaults to the global `fetch` */
  fetch?: FetchLike
  /** The clock to wait on; defaults to a timer */
  sleep?: SleepLike
  /** Least milliseconds between one request completing and the next starting; defaults to {@link MIN_REQUEST_GAP_MS} */
  minGapMs?: number
  /** Times a transient failure is retried; defaults to {@link MAX_RETRIES} */
  maxRetries?: number
  /** Called with a line of progress for whoever is watching the run */
  onProgress?: (message: string) => void
}

/** The three things the collector asks npm. */
export interface NpmClient {
  /**
   * Fetch one span of daily counts and check it against the request.
   *
   * @param request - The package and span
   * @returns The validated daily records
   */
  fetchRange(request: RangeRequest): Promise<DailyDownloads[]>
  /**
   * Ask which day npm has most recently finished counting.
   *
   * @param packageName - Any published package; the answer is the same for all of them
   * @returns The newest counted day
   */
  fetchLastDay(packageName: string): Promise<Day>
  /**
   * Ask when a package was first published.
   *
   * @param packageName - Full npm package name
   * @returns The UTC day of the package's creation
   */
  fetchCreated(packageName: string): Promise<Day>
  /** How many requests reached the network, retries included */
  readonly requestCount: number
}

/**
 * Wait for a number of milliseconds.
 *
 * @param ms - How long
 * @returns A promise that resolves once the time has passed
 */
function sleepFor(ms: number): Promise<void> {
  return createPromise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Encode a package name for a URL path, keeping the scope's `@`.
 *
 * @param packageName - Full npm package name
 * @returns The name with its slash percent-encoded, as npm expects
 */
function encodePackage(packageName: string): string {
  return packageName.replace('/', '%2F')
}

/**
 * Turn an HTTP status into the failure it signals.
 *
 * @param status - The status code
 * @param packageName - The package the request was about
 * @param url - The request URL
 * @returns The classified error
 */
function classifyStatus(status: number, packageName: string, url: string): NpmStatsError {
  if (status === 404) {
    return new NpmStatsError(
      'package-not-found',
      `npm knows no package ${packageName}; is it published, and spelled as in its package.json? (${url})`
    )
  }
  if (status === 429) {
    return new NpmStatsError('rate-limited', `npm rate-limited the request for ${packageName} (HTTP 429, ${url})`)
  }
  if (status >= 500) {
    return new NpmStatsError('unavailable', `npm answered ${packageName} with HTTP ${status} (${url})`)
  }
  return new NpmStatsError('request-rejected', `npm rejected the request for ${packageName} with HTTP ${status} (${url})`)
}

/**
 * A paced, retrying client for npm's download and registry APIs.
 *
 * Requests go out one at a time. After each one completes, successfully or
 * not, the client waits at least the configured gap before starting the
 * next, so a whole refresh is a slow, polite trickle rather than a burst. A
 * request that fails for a transient reason (the API is down, or asks for a
 * pause) is retried with doubling backoff on top of that gap; a request that
 * fails for any other reason is not retried, because retrying a missing
 * package or a changed schema would only delay the same answer.
 *
 * Every response is validated before it is returned, so a caller only ever
 * sees data that matches what it asked for.
 *
 * @param options - Transport, clock, and pacing; all optional
 * @returns A client that paces, retries and validates every request
 *
 * @example Reading a week of counts
 * ```typescript
 * const client = createNpmClient()
 * const week = await client.fetchRange({ package: '@hyperfrontend/features', start: '2026-09-01', end: '2026-09-07' })
 * ```
 */
export function createNpmClient(options: NpmClientOptions = {}): NpmClient {
  const transport = options.fetch ?? ((url: string) => fetch(url))
  const sleep = options.sleep ?? sleepFor
  const minGapMs = options.minGapMs ?? MIN_REQUEST_GAP_MS
  const maxRetries = options.maxRetries ?? MAX_RETRIES
  const onProgress = options.onProgress ?? (() => undefined)
  let requestCount = 0
  let paced = false

  const requestJson = async (url: string, packageName: string): Promise<unknown> => {
    // why: the gap is measured from the completion of the previous request, so it is taken before each request rather than after, and the first request of a run waits for nothing
    if (paced) await sleep(minGapMs)
    paced = true
    requestCount += 1

    let response: Response
    try {
      response = await transport(url)
    } catch (error) {
      throw new NpmStatsError(
        'unavailable',
        `npm could not be reached for ${packageName}: ${error instanceof Error ? error.message : String(error)} (${url})`
      )
    }
    if (!response.ok) throw classifyStatus(response.status, packageName, url)

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('json')) {
      throw new NpmStatsError(
        'schema-drift',
        `npm answered ${packageName} with ${contentType || 'no content type'} rather than JSON (${url})`
      )
    }
    try {
      return await response.json()
    } catch (error) {
      throw new NpmStatsError(
        'malformed-json',
        `npm answered ${packageName} with unreadable JSON: ${error instanceof Error ? error.message : String(error)} (${url})`
      )
    }
  }

  const withRetries = async (url: string, packageName: string): Promise<unknown> => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await requestJson(url, packageName)
      } catch (error) {
        if (!(error instanceof NpmStatsError) || !TRANSIENT_FAILURES.includes(error.kind) || attempt >= maxRetries) throw error
        const backoff = minGapMs * 2 ** (attempt + 1)
        onProgress(`  ↻ ${error.message}; retrying in ${backoff}ms (${attempt + 1}/${maxRetries})`)
        await sleep(backoff)
      }
    }
  }

  return {
    async fetchRange(request) {
      const url = `${DOWNLOADS_API}/range/${request.start}:${request.end}/${encodePackage(request.package)}`
      onProgress(`  → ${request.package} ${request.start}:${request.end}`)
      return validateRangeResponse(await withRetries(url, request.package), request)
    },
    async fetchLastDay(packageName) {
      const url = `${DOWNLOADS_API}/point/last-day/${encodePackage(packageName)}`
      onProgress(`  → newest counted day, via ${packageName}`)
      return validateLastDayResponse(await withRetries(url, packageName), packageName)
    },
    async fetchCreated(packageName) {
      const url = `${REGISTRY_API}/${encodePackage(packageName)}`
      onProgress(`  → first published day of ${packageName}`)
      return validateCreatedResponse(await withRetries(url, packageName), packageName)
    },
    get requestCount() {
      return requestCount
    },
  }
}
