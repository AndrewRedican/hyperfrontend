import type { Day } from './dates'

/**
 * How many days behind the newest published day are still treated as open
 * to revision and asked for again on every read of the statistics service.
 *
 * npm processes a day's logs once, soon after the UTC midnight that ends it,
 * and pads a range request with zeros for every day it has not processed
 * yet. A day is therefore not final the moment it appears. A week is a
 * conservative window: it costs no extra requests, because the same request
 * that asks for the newest days covers it, and it lets a late correction land
 * without anyone noticing it had to.
 */
export const REVALIDATION_DAYS = 7

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
  /** The day the package was first published, as the statistics service reports it */
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
 * Why download statistics could not be read.
 *
 * Each kind answers a different question for whoever reads the failure:
 * whether to ask the statistics service again later, whether its answer
 * changed shape underneath the site, or whether the committed dataset needs
 * repair.
 */
export type NpmStatsFailure = 'unavailable' | 'schema-drift' | 'dataset-corrupt'

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
