import type { BuildContext } from '../../models'
import { join } from '@hyperfrontend/project-scope/core'

/**
 * Resolves the absolute `_dependencies/` root for a build: the bundled-dep
 * "never touch" zone every prune pass guards. Pair it with {@link isUnderDir} to
 * derive both the bundled-dep write paths and the guard from one source string.
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
