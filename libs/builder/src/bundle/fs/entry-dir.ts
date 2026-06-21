import type { BuildContext, EntryPoint } from '../../models'
import { join } from '@hyperfrontend/project-scope/core'

/**
 * Resolves an entry point's absolute output directory in the built package tree.
 *
 * The root entry (`src/index.ts`) emits straight into the package root, so it
 * maps to `context.outputPath`; every other entry mirrors its `src/` subpath
 * (e.g. `browser/v1`) under the output root. Post-emit passes use this to locate
 * the on-disk directory an entry's bundle, declarations, and chunks live in.
 *
 * @param entry - The resolved entry point whose output directory is wanted.
 * @param context - Build context supplying the absolute output root.
 * @returns Absolute path to the entry's output directory.
 *
 * @example Locating a feature entry's output directory
 * ```typescript
 * // entry.srcPath === 'browser/v1' → '<outputPath>/browser/v1'
 * const dir = entryDirOf(entry, context)
 * ```
 */
export const entryDirOf = (entry: EntryPoint, context: BuildContext): string =>
  entry.isRoot ? context.outputPath : join(context.outputPath, entry.srcPath)
