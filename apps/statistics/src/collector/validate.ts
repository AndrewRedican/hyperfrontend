import type { Schema } from '@hyperfrontend/json-utils'
import type { Day } from './dates'
import type { DailyDownloads } from './model'
import { MAX_SAFE_INTEGER } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { createValidator } from '@hyperfrontend/json-utils'
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

/** A range response as far as the collector reads it, once its shape has been checked. */
interface RangeBody {
  /** The package npm says it answered for */
  package: string
  /** The first day npm says it answered for */
  start: string
  /** The last day npm says it answered for */
  end: string
  /** One entry per day */
  downloads: RangeEntry[]
}

/** One day of a range response. */
interface RangeEntry {
  /** The day, as npm writes it */
  day: string
  /** Downloads npm counted that day */
  downloads: number
}

/** A `point/last-day` response as far as the collector reads it. */
interface LastDayBody {
  /** The package npm says it answered for */
  package: string
  /** The newest day npm has counted */
  end: string
}

/** A registry document as far as the collector reads it. */
interface RegistryBody {
  /** The package the document describes */
  name: string
  /** The package's publication times */
  time: RegistryTimes
}

/** The times a registry document records. */
interface RegistryTimes {
  /** When the package was first published, as an ISO timestamp */
  created: string
}

/** A download count npm could plausibly have reported: a whole number, not negative, that a sum can hold exactly. */
const COUNT: Schema = { type: 'integer', minimum: 0, maximum: MAX_SAFE_INTEGER }

/** The shape of a range response: who it is for, the span it claims, and a count for each day. */
const RANGE_SHAPE = createValidator({
  type: 'object',
  required: ['package', 'start', 'end', 'downloads'],
  properties: {
    package: { type: 'string' },
    start: { type: 'string' },
    end: { type: 'string' },
    downloads: {
      type: 'array',
      items: { type: 'object', required: ['day', 'downloads'], properties: { day: { type: 'string' }, downloads: COUNT } },
    },
  },
})

/** The shape of a `point/last-day` response. */
const LAST_DAY_SHAPE = createValidator({
  type: 'object',
  required: ['package', 'end', 'downloads'],
  properties: { package: { type: 'string' }, end: { type: 'string' }, downloads: COUNT },
})

/** The part of a registry document the collector reads; everything else it carries is left alone. */
const REGISTRY_SHAPE = createValidator({
  type: 'object',
  required: ['name', 'time'],
  properties: {
    name: { type: 'string' },
    time: { type: 'object', required: ['created'], properties: { created: { type: 'string' } } },
  },
})

/**
 * Refuse a body whose shape is not the documented one.
 *
 * The shapes are JSON Schemas, so the first thing wrong is reported by where
 * it sits in the body and what was expected there.
 *
 * @param shape - The validator of the documented shape
 * @param body - The parsed JSON npm answered with
 * @param subject - What the body is, for the message
 * @throws {NpmStatsError} `schema-drift`, naming the first field that is not as documented
 */
function assertShape(shape: ReturnType<typeof createValidator>, body: unknown, subject: string): void {
  const [problem] = shape(body).errors
  if (problem !== undefined) {
    throw new NpmStatsError('schema-drift', `${subject} is not the documented shape at ${problem.path}: ${problem.message}`)
  }
}

/**
 * Check a range response against the request that produced it, and turn it
 * into daily records.
 *
 * Every field is checked rather than trusted, because the service hands what
 * it is given to a site that states totals and a dataset that is committed,
 * and an API that changed shape would otherwise corrupt both silently. Two
 * checks matter beyond shape. The echoed `start` and `end` must be the
 * requested ones, because npm answers a span longer than eighteen months by
 * moving the start forward without saying so, and a truncated span accepted
 * as complete would leave a hole. And the days must be exactly the requested
 * span, each once and in order, because a missing or repeated day is a sum
 * that is wrong by an amount nobody can see.
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
  assertShape(RANGE_SHAPE, body, `npm range response for ${request.package}`)
  const range = body as RangeBody
  if (range.package !== request.package) {
    throw new NpmStatsError('schema-drift', `npm range response names package ${range.package}, but ${request.package} was requested`)
  }
  if (range.start !== request.start || range.end !== request.end) {
    throw new NpmStatsError(
      'truncated-range',
      `npm answered ${request.package} ${request.start}:${request.end} with ${range.start}:${range.end}; the requested span was not honoured, so the response cannot be trusted as complete`
    )
  }

  const expected = daysInclusive(request.start, request.end)
  if (range.downloads.length !== expected) {
    throw new NpmStatsError(
      'incomplete-range',
      `npm answered ${request.package} ${request.start}:${request.end} with ${range.downloads.length} days where ${expected} were expected`
    )
  }

  const records: DailyDownloads[] = []
  let previous = ''
  for (const entry of range.downloads) {
    if (!isDay(entry.day)) {
      throw new NpmStatsError('schema-drift', `npm range response for ${request.package} holds a day that is no calendar day: ${entry.day}`)
    }
    if (entry.day < request.start || entry.day > request.end) {
      throw new NpmStatsError(
        'incomplete-range',
        `npm range response for ${request.package} holds ${entry.day}, outside ${request.start}:${request.end}`
      )
    }
    // why: as many days as the span has, each inside it and each later than the one before, can only be the span's own days, each once
    if (entry.day <= previous) {
      throw new NpmStatsError(
        'incomplete-range',
        `npm range response for ${request.package} lists ${entry.day} after ${previous}; days are repeated or out of order`
      )
    }
    previous = entry.day
    records.push({ package: request.package, day: entry.day, downloads: entry.downloads })
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
  assertShape(LAST_DAY_SHAPE, body, `npm last-day response for ${packageName}`)
  const point = body as LastDayBody
  if (point.package !== packageName || !isDay(point.end)) {
    throw new NpmStatsError(
      'schema-drift',
      `npm last-day response for ${packageName} names package ${point.package} and day ${point.end}, which is not what was asked or no calendar day`
    )
  }
  return point.end
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
  assertShape(REGISTRY_SHAPE, body, `npm registry document for ${packageName}`)
  const document = body as RegistryBody
  const created = document.time.created.slice(0, 10)
  if (document.name !== packageName || !isDay(created)) {
    throw new NpmStatsError(
      'schema-drift',
      `npm registry document for ${packageName} is named ${document.name} and created ${document.time.created}, which is not what was asked or no readable time`
    )
  }
  return created
}
