import type { Day } from './dates'
import type { DailyDownloads } from './model'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { isSafeInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { daysInclusive, isDay } from './dates'
import { NpmStatsError } from './model'

/** The request a range response is checked against. */
export interface RangeRequest {
  /** Full npm package name */
  package: string
  /** First day asked for */
  start: Day
  /** Last day asked for */
  end: Day
}

/**
 * Whether a value is a plain object with string keys.
 *
 * @param value - Anything parsed from JSON
 * @returns True for an object that is neither null nor an array
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !isArray(value)
}

/**
 * Whether a value is a download count npm could plausibly have reported.
 *
 * @param value - The `downloads` field of a record
 * @returns True for a non-negative safe integer
 */
function isCount(value: unknown): value is number {
  return typeof value === 'number' && isSafeInteger(value) && value >= 0
}

/**
 * Check a range response against the request that produced it, and turn it
 * into daily records.
 *
 * Every field is checked rather than trusted, because the collector writes
 * what it is given into a committed dataset and an API that changed shape
 * would otherwise corrupt it silently. Two checks matter beyond shape. The
 * echoed `start` and `end` must be the requested ones, because npm answers a
 * span longer than eighteen months by moving the start forward without
 * saying so, and a truncated span accepted as complete would leave a hole
 * that every later refresh treats as final. And the days must be exactly
 * the requested span, each once and in order, because a missing or repeated
 * day is a sum that is wrong by an amount nobody can see.
 *
 * @param body - The parsed JSON npm answered with
 * @param request - What was asked for
 * @returns The daily records, in the order npm gave them
 * @throws {NpmStatsError} With a kind naming which expectation the response broke
 *
 * @example Accepting a well-formed week
 * ```typescript
 * validateRangeResponse(body, { package: '@hyperfrontend/features', start: '2026-09-01', end: '2026-09-07' })
 * // [{ package: '@hyperfrontend/features', day: '2026-09-01', downloads: 6 }, ...]
 * ```
 */
export function validateRangeResponse(body: unknown, request: RangeRequest): DailyDownloads[] {
  if (!isRecord(body)) {
    throw new NpmStatsError('schema-drift', `npm range response for ${request.package} is not a JSON object`)
  }
  if (body['package'] !== request.package) {
    throw new NpmStatsError(
      'schema-drift',
      `npm range response names package ${String(body['package'])}, but ${request.package} was requested`
    )
  }
  if (body['start'] !== request.start || body['end'] !== request.end) {
    throw new NpmStatsError(
      'truncated-range',
      `npm answered ${request.package} ${request.start}:${request.end} with ${String(body['start'])}:${String(body['end'])}; the requested span was not honoured, so the response cannot be trusted as complete`
    )
  }
  const downloads = body['downloads']
  if (!isArray(downloads)) {
    throw new NpmStatsError('schema-drift', `npm range response for ${request.package} carries no downloads array`)
  }

  const expected = daysInclusive(request.start, request.end)
  if (downloads.length !== expected) {
    throw new NpmStatsError(
      'incomplete-range',
      `npm answered ${request.package} ${request.start}:${request.end} with ${downloads.length} days where ${expected} were expected`
    )
  }

  const records: DailyDownloads[] = []
  const seen = createSet<string>()
  let previous = ''
  for (const entry of downloads) {
    if (!isRecord(entry) || typeof entry['day'] !== 'string' || !isDay(entry['day']) || !isCount(entry['downloads'])) {
      throw new NpmStatsError(
        'schema-drift',
        `npm range response for ${request.package} holds a malformed day record: ${stringifyForMessage(entry)}`
      )
    }
    const day = entry['day']
    if (day < request.start || day > request.end) {
      throw new NpmStatsError(
        'incomplete-range',
        `npm range response for ${request.package} holds ${day}, outside ${request.start}:${request.end}`
      )
    }
    if (seen.has(day)) {
      throw new NpmStatsError('incomplete-range', `npm range response for ${request.package} lists ${day} twice`)
    }
    if (day <= previous) {
      throw new NpmStatsError(
        'incomplete-range',
        `npm range response for ${request.package} lists ${day} after ${previous}; days are out of order`
      )
    }
    seen.add(day)
    previous = day
    records.push({ package: request.package, day, downloads: entry['downloads'] })
  }
  return records
}

/**
 * Read the newest counted day out of a `point/last-day` response.
 *
 * @param body - The parsed JSON npm answered with
 * @param packageName - The package the probe named
 * @returns The day npm reported as its most recent
 * @throws {NpmStatsError} When the response is not the documented shape
 *
 * @example
 * ```typescript
 * validateLastDayResponse({ downloads: 11, start: '2026-09-10', end: '2026-09-10', package: '@hyperfrontend/features' }, '@hyperfrontend/features')
 * // '2026-09-10'
 * ```
 */
export function validateLastDayResponse(body: unknown, packageName: string): Day {
  if (
    !isRecord(body) ||
    body['package'] !== packageName ||
    typeof body['end'] !== 'string' ||
    !isDay(body['end']) ||
    !isCount(body['downloads'])
  ) {
    throw new NpmStatsError(
      'schema-drift',
      `npm last-day response for ${packageName} is not the documented shape: ${stringifyForMessage(body)}`
    )
  }
  return body['end']
}

/**
 * Read the day a package was first published out of its registry document.
 *
 * @param body - The parsed JSON the registry answered with
 * @param packageName - The package asked about
 * @returns The UTC day of the package's creation
 * @throws {NpmStatsError} When the document does not carry a creation time
 *
 * @example
 * ```typescript
 * validateCreatedResponse({ name: '@hyperfrontend/features', time: { created: '2026-06-28T13:22:06.094Z' } }, '@hyperfrontend/features')
 * // '2026-06-28'
 * ```
 */
export function validateCreatedResponse(body: unknown, packageName: string): Day {
  if (!isRecord(body) || body['name'] !== packageName || !isRecord(body['time']) || typeof body['time']['created'] !== 'string') {
    throw new NpmStatsError('schema-drift', `npm registry document for ${packageName} carries no time.created`)
  }
  const created = body['time']['created'].slice(0, 10)
  if (!isDay(created)) {
    throw new NpmStatsError(
      'schema-drift',
      `npm registry document for ${packageName} has an unreadable time.created: ${body['time']['created']}`
    )
  }
  return created
}

/**
 * A short, safe rendering of a value for an error message.
 *
 * @param value - Anything
 * @returns The value as JSON, cut to a line
 */
function stringifyForMessage(value: unknown): string {
  try {
    const text = stringify(value)
    return text === undefined ? String(value) : text.slice(0, 200)
  } catch {
    return String(value)
  }
}
