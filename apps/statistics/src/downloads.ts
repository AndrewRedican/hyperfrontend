import type { ServiceResponse } from '@hyperfrontend/server'
import type { History } from './collector/collect'
import type { Day } from './collector/dates'
import { httpError, jsonResponse } from '@hyperfrontend/server'
import { isDay } from './collector/dates'
import { REVALIDATION_DAYS } from './collector/model'

/** Version of the answer's shape, raised when a reader written for it could no longer read the answer. */
export const ANSWER_VERSION = 1

/** Seconds a client or a cache in front of the service may reuse an answer: npm counts a day once, so a few minutes cost nothing. */
const MAX_AGE_SECONDS = 300

/** Seconds a client is asked to wait when the first collection has not finished. */
const RETRY_AFTER_SECONDS = 30

/** One day of a package, without the package name its list already carries. */
export interface DownloadDay {
  /** The UTC day */
  day: Day
  /** Downloads npm counted that day */
  downloads: number
}

/** One package's part of an answer. */
export interface PackageDownloads {
  /** Full npm package name */
  package: string
  /** The day the package was first published */
  created: Day
  /** Downloads summed over every day the package has, whatever day was asked for, so a reader that holds older days of its own can tell whether they still add up to npm's */
  total: number
  /** The package's days on or after the day asked for, in order with no gaps; every day it has when no day was asked for */
  days: DownloadDay[]
}

/** What `GET /v1/downloads` answers with. */
export interface DownloadsAnswer {
  /** See {@link ANSWER_VERSION} */
  version: number
  /** The newest day npm had finished counting when the history was collected */
  frontier: Day
  /** When that collection ran, as an ISO timestamp */
  collectedAt: string
  /** How many days behind the frontier npm may still revise, so a reader knows which of its own days to replace */
  revalidationDays: number
  /** Every tracked package npm knows, in the order the packages are tracked */
  packages: PackageDownloads[]
}

/**
 * Answer a request for the collected download history.
 *
 * A reader that already holds part of the history names the first day it
 * wants and gets that day and every later one; a reader that names none gets
 * everything. Before the first collection has finished there is nothing to
 * answer with, which is a state and not a fault, so it is a 503 that says
 * when to ask again and that no cache may keep.
 *
 * @param held - The collected history, or null before the first collection
 * @param since - The `since` query parameter as sent, or null when absent
 * @returns The response
 * @throws {HttpError} 400 when `since` is not a calendar day
 *
 * @example
 * ```typescript
 * route('GET', '/v1/downloads', (request) => answerDownloads(held, request.query.get('since')))
 * ```
 */
export function answerDownloads(held: History | null, since: string | null): ServiceResponse {
  if (since !== null && !isDay(since)) throw httpError(400, 'since-not-a-day')
  if (held === null) {
    return jsonResponse(503, { error: 'collecting' }, { 'Cache-Control': 'no-store', 'Retry-After': `${RETRY_AFTER_SECONDS}` })
  }
  const answer: DownloadsAnswer = {
    version: ANSWER_VERSION,
    frontier: held.frontier,
    collectedAt: held.collectedAt,
    revalidationDays: REVALIDATION_DAYS,
    packages: [...held.packages].map(([packageName, history]) => ({
      package: packageName,
      created: history.created,
      total: history.days.reduce((sum, record) => sum + record.downloads, 0),
      days: history.days
        .filter((record) => since === null || record.day >= since)
        .map((record) => ({ day: record.day, downloads: record.downloads })),
    })),
  }
  return jsonResponse(200, answer, { 'Cache-Control': `public, max-age=${MAX_AGE_SECONDS}` })
}
