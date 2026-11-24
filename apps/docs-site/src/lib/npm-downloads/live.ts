import type { DownloadDay, DownloadsSnapshot, PackageDownloads } from '../downloads'
import type { Day } from './dates'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { dateParse } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { isNaN as isNotANumber, isSafeInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { ecosystemTotal, rankPackages } from './aggregate'
import { addDays, isDay } from './dates'
import { NpmStatsError, REVALIDATION_DAYS } from './model'

/** Version of the statistics service's answer this site reads. */
export const LIVE_ANSWER_VERSION = 1

/** One package's part of the statistics service's answer. */
export interface LivePackage {
  /** Full npm package name */
  package: string
  /** The day the package was first published */
  created: Day
  /** Downloads summed over every day the service holds for the package, whatever day was asked for */
  total: number
  /** Consecutive days in order, none before the day asked for and none after the frontier */
  days: DownloadDay[]
}

/** What the statistics service answers with, every field checked. */
export interface LiveDownloads {
  /** Shape version, see {@link LIVE_ANSWER_VERSION} */
  version: number
  /** The newest day npm had finished counting when the service last collected */
  frontier: Day
  /** When that collection ran, as an ISO timestamp */
  collectedAt: string
  /** How many days behind the frontier npm may still revise */
  revalidationDays: number
  /** Every package the service holds */
  packages: LivePackage[]
}

/**
 * Build the failure every rejected answer is reported as.
 *
 * @param problem - What the answer got wrong, completing "the statistics service's answer ..."
 * @returns The classified failure
 */
function drift(problem: string): NpmStatsError {
  return new NpmStatsError('schema-drift', `the statistics service's answer ${problem}`)
}

/**
 * Whether a value is a plain keyed object.
 *
 * @param value - Anything read out of the answer
 * @returns True for an object that is neither null nor an array
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !isArray(value)
}

/**
 * Whether a value is a calendar day that exists.
 *
 * @param value - Anything read out of the answer
 * @returns True for a real `YYYY-MM-DD` day
 */
function isRealDay(value: unknown): value is Day {
  return typeof value === 'string' && isDay(value)
}

/**
 * Check one package's days.
 *
 * @param packageName - The package the days belong to
 * @param value - What the answer carries as its days
 * @param since - The first day asked for, or null when every day was
 * @param frontier - The answer's own frontier
 * @returns The days, in order
 * @throws {NpmStatsError} Naming the first day that breaks the contract
 */
function readDays(packageName: string, value: unknown, since: Day | null, frontier: Day): DownloadDay[] {
  if (!isArray(value)) throw drift(`carries no list of days for ${packageName}`)
  const days: DownloadDay[] = []
  for (const entry of value as unknown[]) {
    if (!isRecord(entry)) throw drift(`carries a day of ${packageName} that is not an object`)
    const day = entry['day']
    const downloads = entry['downloads']
    if (!isRealDay(day)) throw drift(`carries a malformed day for ${packageName}: ${String(day)}`)
    if (typeof downloads !== 'number' || !isSafeInteger(downloads) || downloads < 0) {
      throw drift(`carries a malformed count for ${packageName} on ${day}: ${String(downloads)}`)
    }
    const previous = days.at(-1)
    if (previous !== undefined && day !== addDays(previous.day, 1)) {
      throw drift(`jumps from ${previous.day} to ${day} for ${packageName}; days must be consecutive`)
    }
    if (since !== null && day < since) throw drift(`carries ${day} for ${packageName}, before the day asked for, ${since}`)
    if (day > frontier) throw drift(`carries ${day} for ${packageName}, after its own frontier, ${frontier}`)
    days.push({ day, downloads })
  }
  return days
}

/**
 * Check the total a package's entry states against the days it carries.
 *
 * @param packageName - The package the total belongs to
 * @param value - What the answer carries as its total
 * @param days - The package's answered days, already checked
 * @param since - The first day asked for, or null when every day was
 * @returns The count the entry states, once it agrees with its days
 * @throws {NpmStatsError} When the total is no count, or cannot be the sum of a history that holds the answered days
 */
function readTotal(packageName: string, value: unknown, days: readonly DownloadDay[], since: Day | null): number {
  if (typeof value !== 'number' || !isSafeInteger(value) || value < 0) {
    throw drift(`carries a malformed total for ${packageName}: ${String(value)}`)
  }
  const answered = days.reduce((sum, entry) => sum + entry.downloads, 0)
  // why: a whole history must add up to its own total exactly, and a part of one can never add up to more than the whole
  if (since === null ? value !== answered : value < answered) {
    throw drift(`states a total of ${value} for ${packageName}, which its days, adding up to ${answered}, contradict`)
  }
  return value
}

/**
 * Check the statistics service's answer against everything the site relies on.
 *
 * Read strictly, the way the committed dataset is: the answer feeds a page
 * that states a total and a script that writes committed files, so an answer
 * in any other shape is refused whole rather than read in part.
 *
 * @param body - The parsed response body
 * @param since - The first day asked for, or null when the whole history was
 * @returns The answer, every field checked
 * @throws {NpmStatsError} `schema-drift`, naming the first thing that is not as agreed
 *
 * @example
 * ```typescript
 * const live = validateLiveAnswer(await response.json(), '2026-11-17')
 * live.frontier // '2026-11-23'
 * ```
 */
export function validateLiveAnswer(body: unknown, since: Day | null): LiveDownloads {
  if (!isRecord(body)) throw drift('is not an object')
  if (body['version'] !== LIVE_ANSWER_VERSION) {
    throw drift(`is version ${String(body['version'])}, this site reads ${LIVE_ANSWER_VERSION}`)
  }
  const frontier = body['frontier']
  if (!isRealDay(frontier)) throw drift(`carries a malformed frontier: ${String(frontier)}`)
  const collectedAt = body['collectedAt']
  if (typeof collectedAt !== 'string' || isNotANumber(dateParse(collectedAt))) {
    throw drift(`carries a malformed collection time: ${String(collectedAt)}`)
  }
  const revalidationDays = body['revalidationDays']
  if (typeof revalidationDays !== 'number' || !isSafeInteger(revalidationDays) || revalidationDays < 1) {
    throw drift(`carries a malformed revalidation window: ${String(revalidationDays)}`)
  }
  const entries = body['packages']
  if (!isArray(entries)) throw drift('carries no list of packages')

  const seen = createSet<string>()
  const packages: LivePackage[] = []
  for (const entry of entries as unknown[]) {
    if (!isRecord(entry)) throw drift('carries a package that is not an object')
    const packageName = entry['package']
    if (typeof packageName !== 'string') throw drift(`carries a package with no name: ${String(packageName)}`)
    if (seen.has(packageName)) throw drift(`carries ${packageName} twice`)
    seen.add(packageName)
    const created = entry['created']
    if (!isRealDay(created)) throw drift(`carries a malformed created day for ${packageName}: ${String(created)}`)
    const days = readDays(packageName, entry['days'], since, frontier)
    packages.push({ package: packageName, created, total: readTotal(packageName, entry['total'], days, since), days })
  }
  return { version: LIVE_ANSWER_VERSION, frontier, collectedAt, revalidationDays, packages }
}

/**
 * The first day worth asking the statistics service for.
 *
 * Not the day after the frontier but far enough back to cover the days npm
 * may still revise, so the answer replaces those days as well as adding the
 * new ones.
 *
 * @param frontier - The newest day already held
 * @param revalidationDays - How many days behind the frontier are still open to revision
 * @returns The day to pass as `since`
 *
 * @example
 * ```typescript
 * liveSince('2026-11-23') // '2026-11-17'
 * ```
 */
export function liveSince(frontier: Day, revalidationDays: number = REVALIDATION_DAYS): Day {
  return addDays(frontier, -(revalidationDays - 1))
}

/**
 * Lay a package's answered days over its built ones.
 *
 * @param built - The package as the site was built with it
 * @param live - The same package in the answer, when the service holds it
 * @returns The package with the answered days in place, or the built one when they cannot be joined to it
 */
function overlayPackage(built: PackageDownloads, live: LivePackage | undefined): PackageDownloads {
  if (live === undefined) return built
  const first = live.days.at(0)
  // why: answered days that start after the day following the last built one would leave a hole, and a chart never draws across one
  if (first === undefined || first.day > addDays(built.lastDay, 1)) return built
  const days = [...built.days.filter((entry) => entry.day < first.day), ...live.days]
  return {
    package: built.package,
    total: days.reduce((sum, entry) => sum + entry.downloads, 0),
    firstDay: days[0].day,
    lastDay: days[days.length - 1].day,
    days,
  }
}

/**
 * Lay the statistics service's answer over the snapshot a page was built with.
 *
 * The built snapshot decides which packages are shown; the answer only
 * replaces and extends their days. An answer older than the snapshot changes
 * nothing, and a package the answer cannot be joined to keeps its built days,
 * so the result is never worse than what the page already shows. Packages are
 * ranked again afterwards, because a few new days can reorder a close pair.
 *
 * @param snapshot - What the page was built with
 * @param live - A validated answer
 * @returns A new snapshot counted through the answer's frontier, or the given one when the answer is older
 *
 * @example
 * ```typescript
 * const current = overlaySnapshot(built, validateLiveAnswer(body, liveSince(built.frontier)))
 * current.frontier // '2026-11-23'
 * ```
 */
export function overlaySnapshot(snapshot: DownloadsSnapshot, live: LiveDownloads): DownloadsSnapshot {
  if (live.frontier < snapshot.frontier) return snapshot
  const answered = createMap(live.packages.map((entry): [string, LivePackage] => [entry.package, entry]))
  const packages = rankPackages(snapshot.packages.map((built) => overlayPackage(built, answered.get(built.package))))
  return { frontier: live.frontier, refreshedAt: live.collectedAt, packages, total: ecosystemTotal(packages) }
}

/**
 * Whether a snapshot's packages add up to what the statistics service holds for them.
 *
 * Asked after recent days have been laid over a snapshot. A package whose
 * total still differs from the service's has an older day that changed: npm
 * reports a day it has not processed yet as zero and fills it in later, and
 * an answer that starts at a recent day cannot carry that correction.
 *
 * @param snapshot - A snapshot, usually one recent days were just laid over
 * @param live - The answer whose totals it is held to
 * @returns True when every package the service holds has the service's total
 *
 * @example
 * ```typescript
 * if (!addsUpTo(overlaid, recent)) askForTheWholeHistory()
 * ```
 */
export function addsUpTo(snapshot: DownloadsSnapshot, live: LiveDownloads): boolean {
  const totals = createMap(live.packages.map((entry): [string, number] => [entry.package, entry.total]))
  return snapshot.packages.every((entry) => (totals.get(entry.package) ?? entry.total) === entry.total)
}

/**
 * Bring the snapshot a page was built with up to what the statistics service holds.
 *
 * Asks first for the recent days only, which is a small answer and nearly
 * always enough. When a package then still does not add up to the service's
 * total, an older day has been corrected since the page was built, and the
 * whole history is asked for once and laid over the built snapshot instead.
 * Should that second request fail, the recent days are still shown.
 *
 * @param built - What the page was built with
 * @param ask - Asks the service for its answer from a day onwards, or for the whole history when given null; rejects when no usable answer came back
 * @returns The snapshot with the service's days in place
 * @throws {NpmStatsError} When the first answer is not as agreed; whatever `ask` rejects with otherwise
 *
 * @example
 * ```typescript
 * const current = await readLiveSnapshot(built, (since) => fetchAnswer(since))
 * ```
 */
export async function readLiveSnapshot(built: DownloadsSnapshot, ask: (since: Day | null) => Promise<unknown>): Promise<DownloadsSnapshot> {
  const since = liveSince(built.frontier)
  const recent = validateLiveAnswer(await ask(since), since)
  // why: a service that is behind the build has nothing to add, and its totals would differ for that reason alone
  if (recent.frontier < built.frontier) return built
  const overlaid = overlaySnapshot(built, recent)
  if (addsUpTo(overlaid, recent)) return overlaid
  try {
    return overlaySnapshot(built, validateLiveAnswer(await ask(null), null))
  } catch {
    return overlaid
  }
}
