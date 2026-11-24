import type { NpmClient } from './client'
import type { Day } from './dates'
import type { DailyDownloads } from './model'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { CHUNK_DAYS, NpmStatsError } from './model'
import { splitSpan } from './plan'

/** Everything collected about one package. */
export interface PackageHistory {
  /** The day the package was first published, so no request asks about days before it existed */
  readonly created: Day
  /** Every day from the first published one to the frontier, in order with no gaps */
  readonly days: readonly DailyDownloads[]
}

/**
 * Everything the service holds: one consistent collection, replaced whole by the next.
 */
export interface History {
  /** The newest day npm had finished counting when the history was collected */
  readonly frontier: Day
  /** When the collection that produced this history ran, as an ISO timestamp */
  readonly collectedAt: string
  /** Each tracked package npm knows, in the order the packages are tracked */
  readonly packages: ReadonlyMap<string, PackageHistory>
}

/** What a collection needs. */
export interface CollectOptions {
  /** Every package to track, by full npm name */
  packages: readonly string[]
  /** The client requests go through */
  client: NpmClient
  /** The current time in milliseconds since the epoch */
  now: number
  /** The history collected before, or null before the first collection */
  held: History | null
}

/** What a collection did. */
export interface Collection {
  /** Whether npm had anything the held history lacked */
  outcome: 'unchanged' | 'collected'
  /** The history to hold from now on: the held one when nothing changed */
  history: History
  /** Tracked packages npm does not know, which the next collection asks about again */
  pending: string[]
}

/**
 * Whether a failure says npm does not know the package.
 *
 * @param error - Whatever a request threw
 * @returns True for a missing package, which is a state to wait out and not a fault
 */
function isUnknownPackage(error: unknown): boolean {
  return error instanceof NpmStatsError && error.kind === 'package-not-found'
}

/**
 * Ask npm which day it has most recently finished counting.
 *
 * The answer is the same whichever package is asked about, so the first
 * tracked package npm knows is enough. One that is tracked ahead of its first
 * release is passed over.
 *
 * @param packages - The tracked packages
 * @param client - The client requests go through
 * @returns The newest counted day
 * @throws {NpmStatsError} When npm knows none of the packages, or a request failed
 */
async function probeFrontier(packages: readonly string[], client: NpmClient): Promise<Day> {
  for (const packageName of packages) {
    try {
      return await client.fetchLastDay(packageName)
    } catch (error) {
      if (!isUnknownPackage(error)) throw error
    }
  }
  throw new NpmStatsError(
    'package-not-found',
    `npm knows none of the ${packages.length} tracked packages, so there is no history to collect`
  )
}

/**
 * Read one package's whole history, from its first published day to the frontier.
 *
 * @param packageName - Full npm package name
 * @param known - What is held about the package, or undefined when it is new
 * @param frontier - The newest day npm has counted
 * @param client - The client requests go through
 * @returns The package's history through the frontier
 */
async function collectPackage(
  packageName: string,
  known: PackageHistory | undefined,
  frontier: Day,
  client: NpmClient
): Promise<PackageHistory> {
  const created = known?.created ?? (await client.fetchCreated(packageName))
  const days: DailyDownloads[] = []
  for (const span of splitSpan(created, frontier, CHUNK_DAYS)) {
    days.push(...(await client.fetchRange({ package: packageName, ...span })))
  }
  return { created, days }
}

/**
 * Bring the held history up to date with npm.
 *
 * The run is a sequence, deliberately: ask npm which day it has most recently
 * counted; when that day is the one already held, leave every held package
 * alone and ask only about the packages npm did not know last time; otherwise
 * read every package's history again, whole, in bounded requests that are each
 * checked against what was asked. Only when every package has come through is
 * a new history returned, so a failure anywhere leaves the held history
 * exactly as it was and a reader never sees half a collection.
 *
 * A history is read whole rather than extended because npm revises it: a day
 * it has not processed is reported as zero and filled in later, sometimes
 * more than a week later. One request covers more than a year, so reading
 * everything costs the requests a few recent days would.
 *
 * A tracked package npm does not know is not a failure: a package is tracked
 * from the commit that adds it and published some time after, so it is
 * reported as pending and asked about again on the next run.
 *
 * @param options - See {@link CollectOptions}
 * @returns What the run did and the history to hold
 * @throws {NpmStatsError} When npm broke an expectation; the held history stands in that case
 *
 * @example
 * ```typescript
 * const first = await collect({ packages, client, now: dateNow(), held: null })
 * first.outcome // 'collected'
 * const next = await collect({ packages, client, now: dateNow(), held: first.history })
 * next.outcome // 'unchanged', until npm counts another day
 * ```
 */
export async function collect(options: CollectOptions): Promise<Collection> {
  const held = options.held
  const frontier = await probeFrontier(options.packages, options.client)
  const packages = createMap<string, PackageHistory>()
  const pending: string[] = []
  let learned = false

  for (const packageName of options.packages) {
    const known = held?.packages.get(packageName)
    if (known !== undefined && held?.frontier === frontier) {
      packages.set(packageName, known)
      continue
    }
    try {
      packages.set(packageName, await collectPackage(packageName, known, frontier, options.client))
      learned = true
    } catch (error) {
      if (!isUnknownPackage(error)) throw error
      pending.push(packageName)
      // why: a package npm stops answering for keeps the days already collected, since history is never discarded by omission
      if (known !== undefined) packages.set(packageName, known)
    }
  }

  if (held !== null && !learned) return { outcome: 'unchanged', history: held, pending }
  return { outcome: 'collected', history: { frontier, collectedAt: createDate(options.now).toISOString(), packages }, pending }
}
