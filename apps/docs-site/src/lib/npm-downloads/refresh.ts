import type { NpmClient } from './client'
import type { Day } from './dates'
import type { DailyDownloads, Dataset, DatasetManifest } from './model'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { commitDataset, mergeRecords, readDataset } from './dataset'
import { formatDay } from './dates'
import { DATASET_VERSION, REVALIDATION_DAYS } from './model'
import { planFetches } from './plan'

/** What a refresh needs. */
export interface RefreshOptions {
  /** The dataset directory */
  dir: string
  /** Every package to track, by full npm name */
  packages: readonly string[]
  /** The client requests go through */
  client: NpmClient
  /** The current time in milliseconds since the epoch */
  now: number
  /** Refresh even when the dataset looks fresh enough */
  force?: boolean
  /** Called with a line of progress for whoever is watching the run */
  onProgress?: (message: string) => void
}

/** What a refresh did. */
export interface RefreshResult {
  /** Why the run ended where it did */
  outcome: 'not-due' | 'up-to-date' | 'refreshed'
  /** The newest counted day npm reported, or the stored one when no probe was made */
  frontier: Day | null
  /** Files written, empty unless something changed */
  changed: string[]
  /** Requests that reached the network */
  requests: number
}

/**
 * Whether the dataset could have something new to learn.
 *
 * npm publishes each day's counts once, soon after the UTC midnight that
 * ends it, so a dataset refreshed earlier today has nothing to gain from
 * asking again: the answer would be the one it already has. A refresh is
 * due when the last one ran on an earlier UTC day, or never ran at all.
 *
 * @param manifest - The stored manifest, or null before the first refresh
 * @param now - The current time in milliseconds since the epoch
 * @returns True when a refresh could learn something
 *
 * @example A dataset refreshed yesterday is due
 * ```typescript
 * isRefreshDue({ refreshedAt: '2026-09-11T08:00:00.000Z', ... }, dateParse('2026-09-12T00:30:00.000Z')) // true
 * ```
 */
export function isRefreshDue(manifest: DatasetManifest | null, now: number): boolean {
  if (manifest === null) return true
  return formatDay(createDate(manifest.refreshedAt).getTime()) < formatDay(now)
}

/**
 * Whether two runs of records are the same days with the same counts.
 *
 * @param a - One run
 * @param b - The other
 * @returns True when nothing differs
 */
function sameRecords(a: readonly DailyDownloads[], b: readonly DailyDownloads[]): boolean {
  return a.length === b.length && a.every((record, index) => record.day === b[index].day && record.downloads === b[index].downloads)
}

/**
 * Bring the dataset up to date with npm.
 *
 * The run is a sequence, deliberately: decide whether anything could have
 * changed; ask npm which day it has most recently counted; for each package,
 * learn its first published day if that is not yet known, plan the bounded
 * requests that cover what is missing or still open to revision, make them,
 * validate each answer, and merge; and only when every package has come
 * through cleanly, write everything to disk in one transaction. A failure
 * anywhere before the write leaves the directory exactly as it was found,
 * so a half-finished run can never be committed by accident.
 *
 * @param options - See {@link RefreshOptions}
 * @returns What the run did
 * @throws {NpmStatsError} When npm or the dataset broke an expectation; nothing is written in that case
 *
 * @example
 * ```typescript
 * const result = await refreshDownloads({ dir, packages, client: createNpmClient(), now: dateNow() })
 * result.outcome // 'refreshed'
 * ```
 */
export async function refreshDownloads(options: RefreshOptions): Promise<RefreshResult> {
  const onProgress = options.onProgress ?? (() => undefined)
  const dataset: Dataset = readDataset(options.dir)
  const stored = dataset.manifest

  if (!options.force && !isRefreshDue(stored, options.now)) {
    onProgress(`Dataset was refreshed today (${stored?.refreshedAt}); npm publishes once a day, so there is nothing new to ask for.`)
    return { outcome: 'not-due', frontier: stored?.frontier ?? null, changed: [], requests: 0 }
  }

  const probe = options.packages[0]
  if (probe === undefined) throw createError('No packages to refresh')
  const frontier = await options.client.fetchLastDay(probe)
  onProgress(`npm has counted through ${frontier}`)

  const packages: DatasetManifest['packages'] = {}
  const days = createMap<string, DailyDownloads[]>()
  let learnedSomething = false

  for (const packageName of options.packages) {
    const known = stored?.packages[packageName]?.created
    const created = known ?? (await options.client.fetchCreated(packageName))
    if (known === undefined) learnedSomething = true
    packages[packageName] = { created }

    const existing = dataset.days.get(packageName) ?? []
    const chunks = planFetches({
      package: packageName,
      created,
      frontier,
      previousFrontier: stored?.frontier,
      stored: existing.map((record) => record.day),
    })
    if (chunks.length === 0) {
      days.set(packageName, existing)
      continue
    }

    const fetched: DailyDownloads[] = []
    for (const chunk of chunks) {
      fetched.push(...(await options.client.fetchRange(chunk)))
    }
    const merged = mergeRecords(packageName, existing, fetched)
    if (!sameRecords(existing, merged)) learnedSomething = true
    days.set(packageName, merged)
  }

  // why: a package dropped from the list keeps its file; history is never discarded by omission, only by deleting the file on purpose
  for (const [packageName, records] of dataset.days) {
    if (!days.has(packageName)) days.set(packageName, records)
  }

  // why: every refresh re-reads the revalidation window, so requests were made either way; what decides whether anything is written is whether an answer differed from what was stored
  if (!learnedSomething && stored !== null && stored.frontier === frontier) {
    onProgress('Every answer matched what was stored; nothing to write.')
    return { outcome: 'up-to-date', frontier, changed: [], requests: options.client.requestCount }
  }

  const manifest: DatasetManifest = {
    version: DATASET_VERSION,
    refreshedAt: createDate(options.now).toISOString(),
    frontier,
    revalidationDays: REVALIDATION_DAYS,
    packages,
  }
  const changed = commitDataset(options.dir, manifest, days)
  return { outcome: changed.length === 0 ? 'up-to-date' : 'refreshed', frontier, changed, requests: options.client.requestCount }
}
