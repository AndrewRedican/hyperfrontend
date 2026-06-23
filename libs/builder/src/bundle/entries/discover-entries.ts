import type { EntryPoint, EntryPointCategory, EntryPointDiscovery, EntryPointPlatform } from '../../models'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { exists, isDirectory, join, readDirectory } from '@hyperfrontend/project-scope/core'

const PLATFORM_DIRS = freeze(<const>['browser', 'node'])

const isPlatformDir = (name: string): name is EntryPointPlatform => (<readonly string[]>PLATFORM_DIRS).includes(name)

const hasIndexFile = (dirPath: string): boolean => exists(join(dirPath, 'index.ts'))

const getSubdirectories = (dirPath: string): string[] => {
  if (!exists(dirPath) || !isDirectory(dirPath)) return []
  return readDirectory(dirPath)
    .filter((entry) => entry.isDirectory && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
}

const recurseEntries = (basePath: string, relativePath: string, maxDepth: number): EntryPoint[] => {
  if (maxDepth <= 0) return []
  const currentPath = relativePath ? join(basePath, relativePath) : basePath
  if (!exists(currentPath)) return []

  const entries: EntryPoint[] = []
  for (const subdir of getSubdirectories(currentPath)) {
    const subdirPath = join(currentPath, subdir)
    const subdirRelative = relativePath ? `${relativePath}/${subdir}` : subdir

    if (hasIndexFile(subdirPath)) {
      const firstSegment = <string>subdirRelative.split('/')[0]
      const platform = isPlatformDir(subdir) ? subdir : isPlatformDir(firstSegment) ? firstSegment : undefined
      entries.push({
        exportPath: `./${subdirRelative}`,
        srcPath: subdirRelative,
        inputFile: join(subdirPath, 'index.ts'),
        isRoot: false,
        platform,
      })
    }

    entries.push(...recurseEntries(basePath, subdirRelative, maxDepth - 1))
  }
  return entries
}

const categorize = (hasRootEntry: boolean, platformEntries: EntryPoint[], featureEntries: EntryPoint[]): EntryPointCategory => {
  const hasPlatform = platformEntries.length > 0
  const hasFeature = featureEntries.length > 0
  const hasNestedPlatform = platformEntries.some((e) => e.srcPath.includes('/'))

  if (hasRootEntry && !hasPlatform && !hasFeature) return 'root'
  if (!hasRootEntry && hasPlatform && !hasFeature && !hasNestedPlatform) return 'platform'
  if (!hasRootEntry && !hasPlatform && hasFeature) return 'feature'
  if (hasNestedPlatform) return 'complex'
  return 'hybrid'
}

/**
 * Discovers every entry point exposed by a library project.
 *
 * Scans `<projectRoot>/src` for the root `index.ts` plus every nested directory
 * containing an `index.ts`. Recognized layouts include:
 *
 * - `src/index.ts` — root entry
 * - `src/browser/index.ts`, `src/node/index.ts` — platform entries
 * - `src/<feature>/index.ts` — feature entries
 * - `src/<platform>/<feature>/index.ts` — nested entries (max depth 3)
 *
 * @param projectRoot - Absolute path to the project root.
 * @returns Discovery result containing every entry point with its layout category.
 *
 * @example Discovering entries for a barrel library
 * ```typescript
 * const discovery = discoverEntries('/abs/path/to/libs/utils')
 * discovery.category   // => 'feature' | 'platform' | 'hybrid' | ...
 * discovery.entryPoints // => [{ exportPath: '.', ... }, ...]
 * ```
 */
export const discoverEntries = (projectRoot: string): EntryPointDiscovery => {
  const srcPath = join(projectRoot, 'src')
  const entryPoints: EntryPoint[] = []
  const rootIndexPath = join(srcPath, 'index.ts')
  const hasRootEntry = exists(rootIndexPath)

  if (hasRootEntry) {
    entryPoints.push({
      exportPath: '.',
      srcPath: '',
      inputFile: rootIndexPath,
      isRoot: true,
    })
  }

  entryPoints.push(...recurseEntries(srcPath, '', 3))

  const firstSegmentOf = (entry: EntryPoint): string => <string>entry.srcPath.split('/')[0]
  const platformEntries = entryPoints.filter((e) => !e.isRoot && isPlatformDir(firstSegmentOf(e)))
  const featureEntries = entryPoints.filter((e) => !e.isRoot && !isPlatformDir(firstSegmentOf(e)))

  return {
    category: categorize(hasRootEntry, platformEntries, featureEntries),
    entryPoints,
    hasRootEntry,
    platformEntries,
    featureEntries,
  }
}
