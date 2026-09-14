import type { Day } from './npm-downloads/dates'
import type { DailyDownloads } from './npm-downloads/model'
import { resolve } from 'node:path'
import { ecosystemTotal, rankPackages, summarize } from './npm-downloads/aggregate'
import { readDataset } from './npm-downloads/dataset'

/** Where the committed download history is read from at build time. */
const DATASET_DIR = resolve(process.cwd(), 'data/npm-downloads')

/** One day, stripped of the package name it repeats in the dataset. */
export interface DownloadDay {
  /** The UTC day */
  day: Day
  /** Downloads npm counted that day */
  downloads: number
}

/** One package's tracked history, ready for a page. */
export interface PackageDownloads {
  /** Full npm package name */
  package: string
  /** Sum of every stored daily count */
  total: number
  /** First stored day */
  firstDay: Day
  /** Last stored day */
  lastDay: Day
  /** Every stored day, in order */
  days: DownloadDay[]
}

/** Everything the downloads page and the pills draw from. */
export interface DownloadsSnapshot {
  /** The newest day npm had finished counting when the dataset was refreshed */
  frontier: Day
  /** When the dataset was last refreshed, as an ISO timestamp */
  refreshedAt: string
  /** Every tracked package, most downloaded first */
  packages: PackageDownloads[]
  /** Raw npm downloads summed across every tracked package */
  total: number
}

/** The snapshot, built once for the life of the build. */
let snapshotCache: DownloadsSnapshot | null = null

/**
 * Read the committed download history and rank it.
 *
 * Read from the repository rather than from npm, so a build is a function of
 * the checked-in files and two builds of the same commit draw the same
 * charts. The dataset is refreshed by its own command; nothing here reaches
 * the network.
 *
 * @returns The snapshot, or null when no history has been collected yet
 *
 * @example
 * ```typescript
 * getDownloadsSnapshot()?.packages[0].package // '@hyperfrontend/features'
 * ```
 */
export function getDownloadsSnapshot(): DownloadsSnapshot | null {
  if (snapshotCache !== null) return snapshotCache

  const dataset = readDataset(DATASET_DIR)
  if (dataset.manifest === null) return null

  const totals = rankPackages([...dataset.days.entries()].map(([packageName, records]) => summarize(packageName, records)))
  const packages: PackageDownloads[] = []
  for (const total of totals) {
    const records = dataset.days.get(total.package) ?? []
    if (total.firstDay === null || total.lastDay === null) continue
    packages.push({
      package: total.package,
      total: total.total,
      firstDay: total.firstDay,
      lastDay: total.lastDay,
      days: records.map((record: DailyDownloads): DownloadDay => ({ day: record.day, downloads: record.downloads })),
    })
  }

  snapshotCache = {
    frontier: dataset.manifest.frontier,
    refreshedAt: dataset.manifest.refreshedAt,
    packages,
    total: ecosystemTotal(totals),
  }
  return snapshotCache
}

/**
 * One package's tracked history.
 *
 * @param packageName - Full npm package name
 * @returns The history, or null when the package is not tracked
 *
 * @example
 * ```typescript
 * getPackageDownloads('@hyperfrontend/features')?.total // 3386
 * ```
 */
export function getPackageDownloads(packageName: string): PackageDownloads | null {
  return getDownloadsSnapshot()?.packages.find((entry) => entry.package === packageName) ?? null
}
