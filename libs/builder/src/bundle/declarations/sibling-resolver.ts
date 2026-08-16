import type { Plugin } from 'rollup'
import { isAbsolute as nodeIsAbsolute, resolve as nodeResolve } from 'node:path'
import { join, normalizeToForwardSlashes } from '../fs/posix-path'

/**
 * Sibling entry record consumed by {@link createSiblingExternalizePlugin}.
 *
 * Each sibling represents another entry-point in the same library that has its
 * own bundled `index.d.ts`. The per-entry d.ts pass externalizes imports that
 * resolve into a sibling's directory so consumers see one canonical type
 * surface (e.g., `import type { EntryPoint } from '../models'` instead of an
 * inlined declaration in every entry).
 */
export interface SiblingEntry {
  /** Entry's `srcPath` (subpath under `<outputPath>`). `''` for the package root. */
  srcPath: string
  /** Absolute path to the entry's bundled `index.d.ts`. */
  indexDtsPath: string
}

/**
 * Inputs to {@link createSiblingExternalizePlugin}.
 */
export interface SiblingResolverInput {
  /** `srcPath` of the entry the plugin is rewriting. */
  selfSrcPath: string
  /** Absolute path to the current entry's bundled `index.d.ts`. */
  selfDtsPath: string
  /** Other entries' bundled `index.d.ts` records. */
  siblings: SiblingEntry[]
}

const stripTrailingIndexDts = (filePath: string): string => {
  const normalized = normalizeToForwardSlashes(filePath)
  const trimmed = normalized.replace(/\/index\.d\.ts$/, '')
  return trimmed === normalized ? normalized.replace(/\.d\.ts$/, '') : trimmed
}

const stripTrailingSlash = (value: string): string => (value.endsWith('/') ? value.slice(0, -1) : value)

const dirnameOf = (filePath: string): string => {
  const normalized = normalizeToForwardSlashes(filePath)
  const idx = normalized.lastIndexOf('/')
  return idx <= 0 ? normalized : normalized.slice(0, idx)
}

/**
 * Computes the directory (without trailing slash) that owns a sibling's
 * `index.d.ts`. Used to test whether an absolute resolved id falls inside the
 * sibling's directory tree.
 *
 * @param sibling - Sibling-entry record.
 * @returns Sibling's directory with no trailing slash.
 */
const siblingDir = (sibling: SiblingEntry): string => stripTrailingSlash(dirnameOf(sibling.indexDtsPath))

const startsWithDir = (resolved: string, dir: string): boolean => {
  const normalizedResolved = normalizeToForwardSlashes(resolved)
  if (normalizedResolved === dir) return true
  return normalizedResolved.startsWith(`${dir}/`)
}

/**
 * Returns the sibling entry whose directory contains `absolutePath`, or `undefined`
 * when no sibling owns the path.
 *
 * @param absolutePath - Resolved absolute path of an import.
 * @param siblings - Sibling-entry records.
 * @returns Owning sibling entry, or `undefined`.
 *
 * @example Identifying a sibling for a resolved type import
 * ```typescript
 * const owner = findOwningSibling('/abs/dist/libs/foo/models/index.d.ts', siblings)
 * ```
 */
export const findOwningSibling = (absolutePath: string, siblings: SiblingEntry[]): SiblingEntry | undefined => {
  const normalized = normalizeToForwardSlashes(absolutePath)
  let best: SiblingEntry | undefined
  let bestDirLength = -1
  for (const sibling of siblings) {
    const dir = siblingDir(sibling)
    if (!startsWithDir(normalized, dir)) continue
    if (dir.length > bestDirLength) {
      best = sibling
      bestDirLength = dir.length
    }
  }
  return best
}

/**
 * Computes the bare-specifier form of a sibling import as emitted in the
 * rewritten `.d.ts` (e.g., `../models`, `../../models`, `./bundle/declarations`).
 *
 * Always omits the trailing `index.d.ts` so both `moduleResolution: 'bundler'`
 * and `node` accept it.
 *
 * @param selfDtsPath - Absolute path to the current entry's `index.d.ts`.
 * @param sibling - The sibling entry being targeted.
 * @returns POSIX-style relative specifier ready for `id` in a rollup external resolution.
 *
 * @example Computing a sibling import from `bundle/index.d.ts` to `models/`
 * ```typescript
 * computeSiblingSpecifier(
 *   '/abs/dist/libs/foo/bundle/index.d.ts',
 *   { srcPath: 'models', indexDtsPath: '/abs/dist/libs/foo/models/index.d.ts' }
 * ) // => '../models'
 * ```
 */
export const computeSiblingSpecifier = (selfDtsPath: string, sibling: SiblingEntry): string => {
  const fromDir = dirnameOf(selfDtsPath)
  const toDir = siblingDir(sibling)
  const fromSegments = fromDir.split('/').filter((s) => s.length > 0)
  const toSegments = toDir.split('/').filter((s) => s.length > 0)
  let common = 0
  while (common < fromSegments.length && common < toSegments.length && fromSegments[common] === toSegments[common]) {
    common += 1
  }
  const upSegments = fromSegments.length - common
  const downSegments = toSegments.slice(common)
  if (upSegments === 0 && downSegments.length === 0) return '.'
  const ups = '../'.repeat(upSegments)
  const downs = downSegments.join('/')
  if (upSegments === 0) return `./${downs}`
  return downs.length > 0 ? `${ups}${downs}` : ups.replace(/\/$/, '')
}

/**
 * Resolves a relative or absolute `source` against `importer` (or `selfDtsPath`
 * when no importer is given) and returns the absolute filesystem candidate
 * suitable for matching against sibling entries.
 *
 * Mirrors TypeScript's lookup rules at the level we need: when the candidate
 * exists as `<candidate>/index.d.ts` we treat that as the resolved file,
 * otherwise the candidate path itself.
 *
 * @param source - The import specifier as it appears in source.
 * @param importer - Absolute path of the importing module, when known.
 * @param selfDtsPath - Absolute path to the entry currently being rewritten (fallback importer).
 * @returns Absolute candidate path for sibling matching.
 */
const resolveCandidate = (source: string, importer: string | undefined, selfDtsPath: string): string => {
  if (nodeIsAbsolute(source)) return normalizeToForwardSlashes(source)
  if (source.startsWith('.')) {
    const fromDir = dirnameOf(importer ?? selfDtsPath)
    return normalizeToForwardSlashes(nodeResolve(fromDir, source))
  }
  return source
}

/**
 * Resolution outcome for the sibling-externalize plugin.
 */
interface SiblingResolution {
  /** Rewritten id: relative specifier targeting the sibling's directory. */
  id: string
  /** Always `true`. */
  external: true
}

/**
 * Returns a rollup plugin that externalizes any import resolving inside a
 * sibling entry's directory tree, rewriting the emitted specifier to a POSIX
 * relative path stripped of `/index` and `.d.ts` suffixes.
 *
 * The plugin's `resolveId` hook returns `null` for everything that does not
 * resolve into a sibling: that lets the rest of the rollup-plugin-dts chain
 * inline third-party type imports as before.
 *
 * Self-ownership is enforced by adding the current entry into the ownership
 * pool: when the deepest-matching entry directory is the entry being rewritten
 * (and not a sibling), the resolver returns `null` so rollup keeps the path
 * internal. This matters for the package root entry whose directory prefix-
 * matches every other entry's path; without including self, root would
 * spuriously claim its own subtree's files.
 *
 * @param input - Self + sibling entry descriptors.
 * @returns Rollup plugin.
 *
 * @example Plugin instance for the bundle entry pass
 * ```typescript
 * const plugin = createSiblingExternalizePlugin({
 *   selfSrcPath: 'bundle',
 *   selfDtsPath: '/abs/dist/libs/foo/bundle/index.d.ts',
 *   siblings: [{ srcPath: 'models', indexDtsPath: '/abs/dist/libs/foo/models/index.d.ts' }],
 * })
 * ```
 */
export const createSiblingExternalizePlugin = (input: SiblingResolverInput): Plugin => {
  const { selfSrcPath, selfDtsPath, siblings } = input
  const selfEntry: SiblingEntry = { srcPath: selfSrcPath, indexDtsPath: selfDtsPath }
  const ownershipPool: SiblingEntry[] = [selfEntry, ...siblings]
  const selfDtsResolved = normalizeToForwardSlashes(selfDtsPath)
  return {
    name: 'externalize-sibling-subpaths',
    resolveId(source: string, importer?: string): SiblingResolution | null {
      if (siblings.length === 0) return null
      const candidate = resolveCandidate(source, importer, selfDtsPath)
      const indexCandidate = candidate.endsWith('.d.ts') ? candidate : `${stripTrailingIndexDts(candidate)}/index.d.ts`
      const owner = findOwningSibling(candidate, ownershipPool) ?? findOwningSibling(indexCandidate, ownershipPool)
      if (!owner) return null
      if (normalizeToForwardSlashes(owner.indexDtsPath) === selfDtsResolved) return null
      return { id: computeSiblingSpecifier(selfDtsPath, owner), external: true }
    },
  }
}

/**
 * Minimal entry-shape projection accepted by {@link filterSiblings}.
 */
export interface SiblingFilterEntry {
  /** Entry's `srcPath`. */
  srcPath: string
}

/**
 * Convenience: filters an entry list to siblings of the supplied `srcPath`.
 *
 * @param srcPath - The entry's `srcPath` to exclude.
 * @param entries - All discovered entries.
 * @returns Entries whose `srcPath` differs from the supplied one.
 *
 * @example Building the sibling list for `bundle/`
 * ```typescript
 * const siblings = filterSiblings('bundle', allEntries)
 * ```
 */
export const filterSiblings = <T extends SiblingFilterEntry>(srcPath: string, entries: T[]): T[] =>
  entries.filter((entry) => entry.srcPath !== srcPath)

/**
 * Joins an output base directory with an entry's `srcPath` to produce the
 * absolute path of the entry's bundled `index.d.ts`.
 *
 * @param outputPath - Absolute output directory.
 * @param srcPath - Entry's `srcPath`. `''` for root.
 * @returns Absolute path to `<outputPath>/<srcPath>/index.d.ts`.
 *
 * @example Computing the d.ts path for a sub-entry
 * ```typescript
 * dtsPathFor('/abs/dist/libs/foo', 'models') // => '/abs/dist/libs/foo/models/index.d.ts'
 * ```
 */
export const dtsPathFor = (outputPath: string, srcPath: string): string =>
  srcPath ? join(outputPath, srcPath, 'index.d.ts') : join(outputPath, 'index.d.ts')
