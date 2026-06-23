import type { InheritFromSpec, PackageJson } from '../../models'
import { exists, readJsonFile } from '@hyperfrontend/project-scope/core'

/**
 * Returns a new `PackageJson` with the requested top-level fields copied from
 * the source described by `spec` onto `target`.
 *
 * The merge is intentionally shallow: only fields named in `spec.fields` are
 * considered, and the original `target` value wins when the source field is
 * missing or `undefined`. The function is a no-op (returns `target` unchanged)
 * when `spec` is omitted, and silently returns `target` when the source file
 * does not exist on disk.
 *
 * @param target - Package.json being assembled for the published artifact.
 * @param spec - Optional inheritance specification: source path + field names to copy.
 * @returns A new `PackageJson` with inherited fields applied.
 *
 * @example Inheriting `repository`, `bugs`, and `author` from the workspace root
 * ```typescript
 * const merged = inheritFields(srcPkg, {
 *   from: '/abs/repo/package.json',
 *   fields: ['repository', 'bugs', 'author'],
 * })
 * ```
 */
export const inheritFields = (target: PackageJson, spec?: InheritFromSpec): PackageJson => {
  if (!spec) return target
  if (!exists(spec.from)) return target

  const source = readJsonFile<PackageJson>(spec.from)
  const merged: PackageJson = { ...target }
  for (const field of spec.fields) {
    if (source[field] !== undefined) merged[field] = source[field]
  }
  return merged
}
