import type { Day } from './dates'

/**
 * Longest span, in days, one range request asks npm for.
 *
 * npm's range endpoint answers at most eighteen months per request and says
 * nothing when it gives less: a request for three years comes back as the
 * most recent 550 days with the `start` quietly moved. Five hundred days is
 * comfortably inside that cap, and the response is checked against the
 * request anyway, so a cap that tightens is caught rather than trusted.
 */
export const CHUNK_DAYS = 500

/**
 * How many days behind the newest counted day a reader is told npm commonly still revises.
 *
 * npm processes a day's logs once, soon after the UTC midnight that ends it,
 * and pads a range request with zeros for every day it has not processed
 * yet, so a day is not final the moment it appears. Most corrections land
 * within a week, and a reader that holds older days of its own replaces at
 * least this many when it asks for recent ones. The collector itself does not
 * rely on the window: npm has filled in days it first reported as zero after
 * that week had passed, so every collection reads each history whole.
 */
export const REVALIDATION_DAYS = 7

/**
 * Least time, in milliseconds, between the end of one request and the start
 * of the next.
 *
 * The ecosystem is small enough that a collection is tens of requests, not
 * thousands, so it is run one request at a time with a pause after each.
 * This is a courtesy to a public API rather than a rate the API demands.
 */
export const MIN_REQUEST_GAP_MS = 1_000

/**
 * Time, in milliseconds, the first retry of a rate-limited request waits; each
 * further retry doubles it.
 *
 * A rate limit is a closed window, not a moment of trouble, so it gets a wait
 * of its own rather than the short backoff a failing server gets. Measured on
 * 2026-11-17: the range endpoint answered twenty requests paced a second
 * apart, refused the twenty-first, and went on refusing it for between
 * twenty-five and thirty seconds, with a `retry-after` of zero throughout.
 * The short backoff's three retries were all spent inside that window, and a
 * collection of more than twenty packages could no longer finish at all. One
 * wait of this length outlasts the window, and the run carries on from the
 * request it stopped at.
 */
export const RATE_LIMIT_PAUSE_MS = 30_000

/** Times a request that failed for a reason worth retrying is tried again. */
export const MAX_RETRIES = 3

/** Where npm serves download counts from. */
export const DOWNLOADS_API = 'https://api.npmjs.org/downloads'

/** Where npm serves package metadata from. */
export const REGISTRY_API = 'https://registry.npmjs.org'

/**
 * One day of one package, exactly as npm reports it.
 */
export interface DailyDownloads {
  /** Full npm package name */
  package: string
  /** The UTC day */
  day: Day
  /** Downloads npm counted that day */
  downloads: number
}

/**
 * Why a request against npm could not be turned into data.
 *
 * Each kind answers a different question for whoever reads the failure:
 * whether to retry, whether the package list is wrong, or whether the API
 * changed shape underneath the collector.
 */
export type NpmStatsFailure =
  | 'unavailable'
  | 'rate-limited'
  | 'package-not-found'
  | 'request-rejected'
  | 'malformed-json'
  | 'schema-drift'
  | 'truncated-range'
  | 'incomplete-range'

/**
 * A failure with a classification, so a caller can act on the kind rather
 * than parse the message.
 */
export class NpmStatsError extends Error {
  /** What went wrong, as a category */
  readonly kind: NpmStatsFailure

  /**
   * Build a classified failure.
   *
   * @param kind - The category of failure
   * @param message - What happened, written for the person who has to fix it
   */
  constructor(kind: NpmStatsFailure, message: string) {
    super(message)
    this.name = 'NpmStatsError'
    this.kind = kind
  }
}

/** Failures worth a retry: the request may well succeed a moment later. */
export const TRANSIENT_FAILURES: readonly NpmStatsFailure[] = ['unavailable', 'rate-limited']
