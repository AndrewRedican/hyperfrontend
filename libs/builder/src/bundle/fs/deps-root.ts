import type { BuildContext } from '../../models'
import { join } from '@hyperfrontend/project-scope/core'

/**
 * Resolves the absolute `_dependencies/` root for a build — the bundled-dep
 * "never touch" zone every prune pass guards.
 *
 * Centralising the `join(outputPath, '_dependencies')` computation keeps the
 * write paths (where pre-pass jobs emit hoisted chunks and declarations) and the
 * {@link isUnderDir} guard derived from the exact same string, so a stray edit to
 * one can't drift the two apart and let a package-tree pass mutate bundled deps.
 *
 * @param context - Build context supplying the absolute output root.
 * @returns Absolute path to `<outputPath>/_dependencies`.
 *
 * @example Deriving the write path and the guard from one source
 * ```typescript
 * const depsRoot = depsRootOf(context)
 * if (isUnderDir(candidate, depsRoot)) continue // never touch bundled deps
 * ```
 */
export const depsRootOf = (context: BuildContext): string => join(context.outputPath, '_dependencies')
