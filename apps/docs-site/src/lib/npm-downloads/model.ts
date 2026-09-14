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
 * How many days behind the newest published day are still treated as open
 * to revision and fetched again on every refresh.
 *
 * npm processes a day's logs once, soon after the UTC midnight that ends it,
 * and pads a range request with zeros for every day it has not processed
 * yet. A day is therefore not final the moment it appears. A week is a
 * conservative window: it costs no extra requests, because the same request
 * that fetches the newest days covers it, and it lets a late correction land
 * without anyone noticing it had to.
 */
export const REVALIDATION_DAYS = 7

/**
 * Least time, in milliseconds, between the end of one request and the start
 * of the next.
 *
 * The ecosystem is small enough that a refresh is tens of requests, not
 * thousands, so it is run one request at a time with a pause after each.
 * This is a courtesy to a public API rather than a rate the API demands.
 */
export const MIN_REQUEST_GAP_MS = 1_000

/** Times a request that failed for a reason worth retrying is tried again. */
export const MAX_RETRIES = 3

/** The earliest day npm holds download counts for at all. */
export const EARLIEST_DAY: Day = '2015-01-10'

/** Where npm serves download counts from. */
export const DOWNLOADS_API = 'https://api.npmjs.org/downloads'

/** Where npm serves package metadata from. */
export const REGISTRY_API = 'https://registry.npmjs.org'

/** Version of the on-disk layout, bumped when a file written before it can no longer be read. */
export const DATASET_VERSION = 1

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

/** What is remembered about a package between refreshes. */
export interface PackageRecord {
  /** The day the package was first published, so no request asks about days before it existed */
  created: Day
}

/**
 * The dataset's own bookkeeping, kept beside the daily records.
 */
export interface DatasetManifest {
  /** Layout version, see {@link DATASET_VERSION} */
  version: number
  /** When the last refresh that changed something ran, as an ISO timestamp */
  refreshedAt: string
  /** The newest day npm had finished counting at that refresh */
  frontier: Day
  /** The revalidation window the refresh honoured, so a reader can tell which stored days were final */
  revalidationDays: number
  /** Per-package bookkeeping, keyed by package name */
  packages: Record<string, PackageRecord>
}

/**
 * Everything on disk, read into memory.
 */
export interface Dataset {
  /** The manifest, or null when no refresh has ever run */
  manifest: DatasetManifest | null
  /** Daily records by package, each list sorted by day with no gaps */
  days: Map<string, DailyDownloads[]>
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
  | 'dataset-corrupt'

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
