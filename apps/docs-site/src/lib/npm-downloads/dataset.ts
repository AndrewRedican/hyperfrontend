import type { DailyDownloads, Dataset, DatasetManifest } from './model'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { addDays, isDay } from './dates'
import { DATASET_VERSION, NpmStatsError } from './model'
import { parseNdjson, serializeNdjson } from './ndjson'

/** Name of the bookkeeping file beside the per-package records. */
export const MANIFEST_FILE = 'manifest.json'

/** Extension every per-package record file carries. */
const RECORDS_EXTENSION = '.ndjson'

/**
 * The file a package's daily records live in.
 *
 * The scope is dropped because every package here shares it and a directory
 * of `@hyperfrontend%2F` prefixes helps nobody; the records inside name the
 * package in full on every line.
 *
 * @param packageName - Full npm package name
 * @returns The file name, relative to the dataset directory
 *
 * @example
 * ```typescript
 * recordsFileFor('@hyperfrontend/features') // 'features.ndjson'
 * ```
 */
export function recordsFileFor(packageName: string): string {
  return `${packageName.replace(/^@[^/]+\//, '')}${RECORDS_EXTENSION}`
}

/**
 * Check that a package's records are sorted, unique, contiguous and all its own.
 *
 * @param packageName - The package the records claim to belong to
 * @param records - The records, in file order
 * @param source - What to call the file in an error
 * @throws {NpmStatsError} Naming the first record that breaks the invariant
 */
export function assertContiguous(packageName: string, records: readonly DailyDownloads[], source: string): void {
  let previous: DailyDownloads | null = null
  for (const record of records) {
    if (record.package !== packageName) {
      throw new NpmStatsError('dataset-corrupt', `${source} holds a record for ${record.package}`)
    }
    if (previous !== null && record.day !== addDays(previous.day, 1)) {
      throw new NpmStatsError(
        'dataset-corrupt',
        `${source} jumps from ${previous.day} to ${record.day}; days must be consecutive, delete the file to rebuild it`
      )
    }
    previous = record
  }
}

/**
 * Read and check the manifest.
 *
 * @param text - The file contents
 * @returns The manifest, every field checked
 * @throws {NpmStatsError} When the file is not a manifest this code can read
 */
function parseManifest(text: string): DatasetManifest {
  let value: unknown
  try {
    value = parse(text)
  } catch {
    throw new NpmStatsError('dataset-corrupt', `${MANIFEST_FILE} is not JSON`)
  }
  if (typeof value !== 'object' || value === null || isArray(value)) {
    throw new NpmStatsError('dataset-corrupt', `${MANIFEST_FILE} is not an object`)
  }
  const manifest = value as Record<string, unknown>
  if (manifest['version'] !== DATASET_VERSION) {
    throw new NpmStatsError(
      'dataset-corrupt',
      `${MANIFEST_FILE} is layout version ${String(manifest['version'])}, this collector reads ${DATASET_VERSION}`
    )
  }
  const frontier = manifest['frontier']
  if (typeof frontier !== 'string' || !isDay(frontier)) {
    throw new NpmStatsError('dataset-corrupt', `${MANIFEST_FILE} carries a malformed frontier: ${String(frontier)}`)
  }
  if (typeof manifest['refreshedAt'] !== 'string' || typeof manifest['revalidationDays'] !== 'number') {
    throw new NpmStatsError('dataset-corrupt', `${MANIFEST_FILE} is missing refreshedAt or revalidationDays`)
  }
  const packages = manifest['packages']
  if (typeof packages !== 'object' || packages === null || isArray(packages)) {
    throw new NpmStatsError('dataset-corrupt', `${MANIFEST_FILE} carries no packages object`)
  }
  for (const [name, record] of entries(packages as Record<string, unknown>)) {
    const created = typeof record === 'object' && record !== null ? (record as Record<string, unknown>)['created'] : undefined
    if (typeof created !== 'string' || !isDay(created)) {
      throw new NpmStatsError('dataset-corrupt', `${MANIFEST_FILE} carries a malformed created day for ${name}: ${String(created)}`)
    }
  }
  return {
    version: DATASET_VERSION,
    refreshedAt: manifest['refreshedAt'],
    frontier,
    revalidationDays: manifest['revalidationDays'],
    packages: packages as DatasetManifest['packages'],
  }
}

/**
 * Read the whole dataset from a directory.
 *
 * Every file is validated on the way in: a record file must parse line by
 * line, hold only its own package, and run over consecutive days with no
 * gap and no repeat. A directory that does not exist is an empty dataset,
 * which is what the very first refresh starts from.
 *
 * @param dir - The dataset directory
 * @returns The manifest and the records by package
 * @throws {NpmStatsError} Naming the file and line that could not be read
 *
 * @example
 * ```typescript
 * const { manifest, days } = readDataset('apps/docs-site/data/npm-downloads')
 * days.get('@hyperfrontend/features')?.length // 75
 * ```
 */
export function readDataset(dir: string): Dataset {
  const days = createMap<string, DailyDownloads[]>()
  if (!existsSync(dir)) return { manifest: null, days }

  const manifestPath = join(dir, MANIFEST_FILE)
  const manifest = existsSync(manifestPath) ? parseManifest(readFileSync(manifestPath, 'utf8')) : null

  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(RECORDS_EXTENSION)) continue
    const records = parseNdjson(readFileSync(join(dir, file), 'utf8'), file)
    if (records.length === 0) continue
    const packageName = records[0].package
    if (recordsFileFor(packageName) !== file) {
      throw new NpmStatsError('dataset-corrupt', `${file} holds records for ${packageName}, which belong in ${recordsFileFor(packageName)}`)
    }
    assertContiguous(packageName, records, file)
    days.set(packageName, records)
  }
  return { manifest, days }
}

/**
 * Merge freshly fetched records into a package's stored ones.
 *
 * A fetched day replaces the stored day of the same date, which is how the
 * revalidation window takes a corrected count; every other stored day is
 * kept. The result is sorted, and checked to be contiguous before it is
 * returned, so a merge can never produce a file the reader would reject.
 *
 * @param packageName - The package both lists belong to
 * @param stored - What was on disk
 * @param fetched - What npm just answered
 * @returns The merged records, sorted by day
 *
 * @example A corrected day replaces its stored count
 * ```typescript
 * mergeRecords('@x/y', [{ package: '@x/y', day: '2026-09-01', downloads: 1 }], [{ package: '@x/y', day: '2026-09-01', downloads: 3 }])
 * // [{ package: '@x/y', day: '2026-09-01', downloads: 3 }]
 * ```
 */
export function mergeRecords(packageName: string, stored: readonly DailyDownloads[], fetched: readonly DailyDownloads[]): DailyDownloads[] {
  const byDay = createMap<string, DailyDownloads>()
  for (const record of stored) byDay.set(record.day, record)
  for (const record of fetched) byDay.set(record.day, record)
  const merged = [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
  assertContiguous(packageName, merged, recordsFileFor(packageName))
  return merged
}

/**
 * The file operations a commit is made of, so a test can interrupt one.
 */
export interface DatasetIo {
  /**
   * Write a whole file.
   *
   * @param path - The file
   * @param contents - Its contents
   */
  writeFile(path: string, contents: string): void
  /**
   * Move a file over another.
   *
   * @param from - The staged file
   * @param to - Its final name
   */
  rename(from: string, to: string): void
  /**
   * Delete a file if it exists.
   *
   * @param path - The file
   */
  remove(path: string): void
}

/** The real file system. */
export const FILE_SYSTEM_IO: DatasetIo = {
  writeFile: (path, contents) => writeFileSync(path, contents),
  rename: (from, to) => renameSync(from, to),
  remove: (path) => rmSync(path, { force: true }),
}

/** One file the commit writes. */
interface StagedFile {
  /** File name, relative to the dataset directory */
  name: string
  /** Its whole new contents */
  contents: string
}

/**
 * Whether a file already holds exactly these contents.
 *
 * @param path - The file
 * @param contents - What it would be written with
 * @returns True when writing would change nothing
 */
function unchanged(path: string, contents: string): boolean {
  return existsSync(path) && readFileSync(path, 'utf8') === contents
}

/**
 * Write a refreshed dataset to disk, all of it or none of it.
 *
 * Files that would be byte-identical are skipped, so a refresh that learned
 * nothing new for a package leaves that package's file untouched and the
 * working tree clean. Everything else is written to a sibling temporary
 * file first, and only once every temporary file exists are they renamed
 * into place. A failure while staging removes what was staged and leaves
 * every original as it was; a failure while renaming restores the files
 * already renamed from the copies held in memory. Either way the directory
 * is never left holding half a refresh.
 *
 * @param dir - The dataset directory
 * @param manifest - The manifest to write
 * @param days - Every package's records
 * @param io - The file operations to commit through; the real file system unless a test says otherwise
 * @returns The names of the files that changed
 *
 * @example
 * ```typescript
 * commitDataset('apps/docs-site/data/npm-downloads', manifest, days)
 * // ['features.ndjson', 'manifest.json']
 * ```
 */
export function commitDataset(
  dir: string,
  manifest: DatasetManifest,
  days: ReadonlyMap<string, readonly DailyDownloads[]>,
  io: DatasetIo = FILE_SYSTEM_IO
): string[] {
  mkdirSync(dir, { recursive: true })

  const staged: StagedFile[] = []
  for (const [packageName, records] of [...days.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    assertContiguous(packageName, records, recordsFileFor(packageName))
    staged.push({ name: recordsFileFor(packageName), contents: serializeNdjson(records) })
  }
  staged.push({ name: MANIFEST_FILE, contents: stringify(manifest, null, 2) + '\n' })

  const changed = staged.filter((file) => !unchanged(join(dir, file.name), file.contents))
  if (changed.length === 0) return []

  const originals = createMap<string, string | null>()
  for (const file of changed) {
    const path = join(dir, file.name)
    originals.set(file.name, existsSync(path) ? readFileSync(path, 'utf8') : null)
  }

  const tempPaths: string[] = []
  try {
    for (const file of changed) {
      const temp = join(dir, `${file.name}.tmp`)
      io.writeFile(temp, file.contents)
      tempPaths.push(temp)
    }
  } catch (error) {
    for (const temp of tempPaths) io.remove(temp)
    throw error
  }

  const renamed: string[] = []
  try {
    for (const file of changed) {
      io.rename(join(dir, `${file.name}.tmp`), join(dir, file.name))
      renamed.push(file.name)
    }
  } catch (error) {
    for (const name of renamed) {
      const original = originals.get(name)
      if (original === null || original === undefined) io.remove(join(dir, name))
      else io.writeFile(join(dir, name), original)
    }
    for (const temp of tempPaths) io.remove(temp)
    throw error
  }

  return changed.map((file) => file.name)
}
