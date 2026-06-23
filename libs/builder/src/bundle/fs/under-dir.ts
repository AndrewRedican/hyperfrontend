/**
 * Tests whether `path` is `dir` itself or lies anywhere beneath it.
 *
 * A pure lexical check: `path` is contained when it equals `dir` or starts with
 * `dir/`. The trailing-slash guard keeps a sibling like `_dependencies-old` from
 * matching `_dependencies`. Post-emit passes use it to enforce the
 * `_dependencies/` "never touch" invariant.
 *
 * @param path - Absolute path to test.
 * @param dir - Absolute directory path that may contain `path`.
 * @returns `true` when `path` equals `dir` or lies under `dir/`.
 *
 * @example Guarding the `_dependencies/` never-touch invariant
 * ```typescript
 * if (isUnderDir(candidate, depsRoot)) continue // never touch bundled deps
 * ```
 */
export const isUnderDir = (path: string, dir: string): boolean => path === dir || path.startsWith(`${dir}/`)
