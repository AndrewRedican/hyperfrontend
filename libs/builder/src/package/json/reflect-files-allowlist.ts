import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { exists, matchGlobPattern, readDirectory, relativePath } from '@hyperfrontend/project-scope/core'

/**
 * Recursive glob covering every `index.*` entrypoint file at any depth — root,
 * secondary entries, and nested `_dependencies` index declarations. `*` spans
 * multi-dot names, so it also matches `index.iife.min.js`, `index.esm.js.map`.
 */
const INDEX_GLOB = '**/index.*'

/**
 * Redundant with {@link INDEX_GLOB} (every `index.d.ts` already matches
 * `index.*`) but emitted explicitly to state the declaration intent and match
 * house convention from the superseded predictive allowlist.
 */
const INDEX_DTS_GLOB = '**/index.d.ts'

/** Root manifest npm always ships; never named in `files`. */
const ROOT_PACKAGE_JSON = 'package.json'

/**
 * Reflects a materialized publishable output tree into a `package.json#files`
 * allowlist.
 *
 * Unlike the predictive approach it replaces, this derives `files` from what the
 * build actually emitted: the two index globs ({@link INDEX_GLOB} +
 * {@link INDEX_DTS_GLOB}) cover every entrypoint `index.*`/`index.d.ts` at any
 * depth, and every surviving non-index file is named explicitly by its
 * package-root-relative POSIX path (no `<dir>/` buckets). Run after every emit
 * phase and the orphan-prune so the walk sees exactly the tree that ships — the
 * invariant being that the publishable output dir contains exactly what ships,
 * so the allowlist is correct by construction.
 *
 * The root `package.json` is skipped (npm always includes it) and `index.*`
 * files are skipped (covered by the glob); metadata files (README, LICENSE,
 * THIRD_PARTY_LICENSES, …) are picked up by the walk only when present.
 *
 * @param outputPath - Absolute path to the materialized publishable output root.
 * @returns Sorted, deduped allowlist entries for `package.json#files`.
 *
 * @example Reflecting a built library's output tree
 * ```typescript
 * const files = reflectFilesAllowlist(ctx.outputPath)
 * // => the two index globs, then 'README.md', 'models.d.ts', 'bin/hf-build.js', ...
 * ```
 */
export const reflectFilesAllowlist = (outputPath: string): string[] => {
  const allow = createSet<string>([INDEX_GLOB, INDEX_DTS_GLOB])
  const visit = (dir: string): void => {
    for (const entry of readDirectory(dir)) {
      if (entry.isDirectory) {
        visit(entry.path)
        continue
      }
      if (!entry.isFile) continue
      const rel = relativePath(outputPath, entry.path)
      if (rel === ROOT_PACKAGE_JSON) continue
      // why: index files at any depth are already covered by the glob; naming them too would be redundant noise.
      if (matchGlobPattern(rel, INDEX_GLOB)) continue
      allow.add(rel)
    }
  }
  if (exists(outputPath)) visit(outputPath)
  return [...allow].sort()
}
