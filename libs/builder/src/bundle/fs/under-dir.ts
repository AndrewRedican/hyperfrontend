import { posix, sep } from 'node:path'

/**
 * Tests whether `path` is `dir` itself or lies anywhere beneath it.
 *
 * A pure lexical check on both paths in POSIX form, so a native Windows path and
 * its forward-slash spelling agree: `path` is contained when it equals `dir` or
 * starts with `dir/`. The trailing-slash guard keeps a sibling like
 * `_dependencies-old` from matching `_dependencies`. Post-emit passes use it to
 * enforce the `_dependencies/` "never touch" invariant.
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
export const isUnderDir = (path: string, dir: string): boolean => {
  const target = path.split(sep).join(posix.sep)
  const root = dir.split(sep).join(posix.sep)
  return target === root || target.startsWith(`${root}/`)
}
