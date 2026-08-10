import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { exists, matchGlobPattern, readDirectory, relativePath } from '@hyperfrontend/project-scope/core'

/**
 * Recursive glob covering every `index.*` entrypoint file at any depth — root,
 * secondary entries, and nested `_dependencies` index declarations. `*` spans
 * multi-dot names, so it also matches `index.iife.min.js` — and, unhelpfully,
 * any JS sourcemap sibling such as `index.esm.js.map`. {@link JS_MAP_EXCLUDE_GLOB}
 * is appended last to subtract those back out (npm resolves `files` patterns
 * top-to-bottom, last match wins).
 */
const INDEX_GLOB = '**/index.*'

/**
 * Redundant with {@link INDEX_GLOB} (every `index.d.ts` already matches
 * `index.*`) but emitted explicitly to state the declaration intent.
 */
const INDEX_DTS_GLOB = '**/index.d.ts'

/**
 * Trailing negation that prevents JS sourcemaps from shipping even if a build
 * re-enables `sourcemap` — the broad {@link INDEX_GLOB} would otherwise match
 * `index.esm.js.map` and friends. Published packages carry no JS maps by policy.
 *
 * Scoped to JS (`*.js.map`); the declaration pass never emits `*.d.ts.map`, so
 * there is nothing of that kind to subtract. Must be emitted **last** in the allowlist: npm evaluates
 * `files` patterns in order and the final match wins, so the negation only
 * subtracts the maps the index glob added when it follows that glob.
 */
const JS_MAP_EXCLUDE_GLOB = '!**/*.js.map'

/** Root manifest npm always ships; never named in `files`. */
const ROOT_PACKAGE_JSON = 'package.json'

/**
 * Reflects a materialized publishable output tree into a `package.json#files`
 * allowlist.
 *
 * Derives `files` from what the build actually emitted: the two index globs
 * cover every entrypoint `index.*`/`index.d.ts` at any depth, and every
 * surviving non-index file is named explicitly by its package-root-relative
 * POSIX path (no `<dir>/` buckets). Run after every emit phase and the
 * orphan-prune so the walk sees exactly the tree that ships; the allowlist is
 * then correct by construction.
 *
 * The root `package.json` is skipped (npm always includes it) and `index.*`
 * files are skipped (covered by the glob); metadata files (README, LICENSE,
 * THIRD_PARTY_LICENSES, …) are picked up by the walk only when present.
 *
 * The sorted positive entries are followed by {@link JS_MAP_EXCLUDE_GLOB} — a
 * trailing negation that subtracts any JS sourcemap the index glob would
 * otherwise ship. It must come last (npm resolves `files` last-match-wins), so
 * it is appended after the sort rather than folded into the sorted set.
 *
 * @param outputPath - Absolute path to the materialized publishable output root.
 * @returns Sorted, deduped positive allowlist entries, then the trailing JS-map
 *   exclusion, for `package.json#files`.
 *
 * @example Reflecting a built library's output tree
 * ```typescript
 * const files = reflectFilesAllowlist(ctx.outputPath)
 * // => the two index globs, then 'README.md', 'models.d.ts', 'bin/hf-build.js', …, '!**\/*.js.map'
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
  // why: the JS-map exclusion must be the final pattern (npm resolves `files` last-match-wins); sorting it in would place '!' ahead of the index glob and the negation would be overridden.
  return [...[...allow].sort(), JS_MAP_EXCLUDE_GLOB]
}
