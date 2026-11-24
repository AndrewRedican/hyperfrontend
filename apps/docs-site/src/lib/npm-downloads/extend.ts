import type { Day } from './dates'
import type { LiveDownloads, LivePackage } from './live'
import type { DailyDownloads, DatasetManifest } from './model'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { commitDataset, mergeRecords, readDataset } from './dataset'
import { validateLiveAnswer } from './live'
import { DATASET_VERSION, NpmStatsError, REVALIDATION_DAYS } from './model'

/** Time, in milliseconds, the statistics service is given to answer before the run gives up. */
export const REQUEST_TIMEOUT_MS = 30_000

/** What extending the dataset needs. */
export interface ExtendOptions {
  /** The dataset directory */
  dir: string
  /** Every published package, by full npm name */
  packages: readonly string[]
  /** Origin of the statistics service, without a trailing slash */
  origin: string
  /** The function the one request goes through */
  fetch: (url: string, init: RequestInit) => Promise<Response>
  /** The current time in milliseconds since the epoch */
  now: number
  /** Called with a line of progress for whoever is watching the run */
  onProgress?: (message: string) => void
}

/** What extending the dataset did. */
export interface ExtendResult {
  /** Whether anything was written */
  outcome: 'up-to-date' | 'refreshed'
  /** The newest day the dataset is counted through once the run has ended */
  frontier: Day
  /** Files written, empty unless something changed */
  changed: string[]
}

/**
 * Whether the service refused because its first collection has not finished.
 *
 * @param response - A response that was not a 200
 * @returns True for the service's own "collecting" answer, false for any other refusal
 */
async function isStillCollecting(response: Response): Promise<boolean> {
  if (response.status !== 503) return false
  try {
    const body: unknown = await response.json()
    return typeof body === 'object' && body !== null && (body as Record<string, unknown>)['error'] === 'collecting'
  } catch {
    return false
  }
}

/**
 * Ask the statistics service for the download history, once.
 *
 * @param options - Where the service is and how to reach it
 * @returns The parsed body of a successful answer, not yet validated
 * @throws {NpmStatsError} `unavailable` when no usable answer came back
 */
async function askService(options: ExtendOptions): Promise<unknown> {
  const url = `${options.origin}/v1/downloads`
  let response: Response
  try {
    response = await options.fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  } catch (error) {
    throw new NpmStatsError(
      'unavailable',
      `the statistics service did not answer at ${url} (${String(error)}); check that it is deployed and reachable, then run the refresh again`
    )
  }
  if (await isStillCollecting(response)) {
    throw new NpmStatsError(
      'unavailable',
      `the statistics service at ${options.origin} is still making its first collection from npm; run the refresh again in a minute`
    )
  }
  if (response.status !== 200) {
    throw new NpmStatsError(
      'unavailable',
      `the statistics service answered ${response.status} at ${url}; check its deployment, then run the refresh again`
    )
  }
  try {
    return (await response.json()) as unknown
  } catch {
    throw new NpmStatsError('schema-drift', `the statistics service's answer at ${url} is not JSON`)
  }
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
 * One package's answered days as the records the dataset stores.
 *
 * @param answered - The package's part of the answer
 * @returns Its days, each naming the package
 */
function recordsOf(answered: LivePackage): DailyDownloads[] {
  return answered.days.map((entry) => ({ package: answered.package, day: entry.day, downloads: entry.downloads }))
}

/**
 * Extend the committed dataset with what the statistics service holds.
 *
 * The run is one request and one write. It asks the service for the whole
 * history and not only for the days since the stored frontier, because npm
 * revises old days too: a day it had not processed is first reported as zero
 * and filled in later, sometimes more than a week later. The answer is
 * validated whole, each published package's answered days are laid over its
 * stored ones, and only when every package has come through cleanly is
 * anything written, in one transaction. A failure anywhere before the write
 * leaves the directory exactly as it was found.
 *
 * A published package the service does not hold keeps what is stored, and so
 * does a package that is stored but no longer published: history is never
 * discarded by omission.
 *
 * @param options - See {@link ExtendOptions}
 * @returns What the run did
 * @throws {NpmStatsError} When the service could not be read or the dataset broke an expectation; nothing is written in that case
 *
 * @example
 * ```typescript
 * const result = await extendDataset({ dir, packages, origin: STATISTICS_ORIGIN, fetch, now: dateNow() })
 * result.outcome // 'refreshed'
 * ```
 */
export async function extendDataset(options: ExtendOptions): Promise<ExtendResult> {
  const onProgress = options.onProgress ?? (() => undefined)
  const dataset = readDataset(options.dir)
  const stored = dataset.manifest

  onProgress('Asking the statistics service for the whole history')
  const answer: LiveDownloads = validateLiveAnswer(await askService(options), null)
  onProgress(`The statistics service has counted through ${answer.frontier}`)

  if (stored !== null && answer.frontier < stored.frontier) {
    onProgress(`The dataset is already counted through ${stored.frontier}; nothing to write.`)
    return { outcome: 'up-to-date', frontier: stored.frontier, changed: [] }
  }

  const answered = createMap(answer.packages.map((entry): [string, LivePackage] => [entry.package, entry]))
  const packages: DatasetManifest['packages'] = {}
  const days = createMap<string, DailyDownloads[]>()
  let differs = stored?.frontier !== answer.frontier

  for (const packageName of options.packages) {
    const entry = answered.get(packageName)
    const created = entry?.created ?? stored?.packages[packageName]?.created
    if (created !== undefined) packages[packageName] = { created }
    if (entry === undefined) {
      onProgress(`${packageName}: the statistics service does not hold it; what is stored is kept`)
      continue
    }
    if (stored?.packages[packageName] === undefined) differs = true
    const existing = dataset.days.get(packageName) ?? []
    const merged = mergeRecords(packageName, existing, recordsOf(entry))
    if (!sameRecords(existing, merged)) differs = true
    days.set(packageName, merged)
  }

  // why: a package the answer lacks, or one dropped from the list, keeps its file; history is never discarded by omission, only by deleting the file on purpose
  for (const [packageName, records] of dataset.days) {
    if (!days.has(packageName)) days.set(packageName, records)
  }

  if (!differs) {
    onProgress('Every answered day matched what was stored; nothing to write.')
    return { outcome: 'up-to-date', frontier: answer.frontier, changed: [] }
  }

  const manifest: DatasetManifest = {
    version: DATASET_VERSION,
    refreshedAt: createDate(options.now).toISOString(),
    frontier: answer.frontier,
    revalidationDays: REVALIDATION_DAYS,
    packages,
  }
  return { outcome: 'refreshed', frontier: answer.frontier, changed: commitDataset(options.dir, manifest, days) }
}
