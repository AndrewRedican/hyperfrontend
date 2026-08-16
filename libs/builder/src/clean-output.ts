import type { BuildContext } from './models'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { exists, join, relativePath, removeDirectory } from '@hyperfrontend/project-scope/core'

/**
 * Empties a build's own output directory before emission so a build never
 * inherits stale artifacts from a previous run, e.g. a `*.js.map` left behind
 * after sourcemaps were turned off, or a chunk for a since-renamed entry.
 *
 * Scoped and guarded: only the *target project's own* directory is removed
 * (e.g. `dist/libs/<project>`), never the shared `dist/` root or anything above
 * it. The path is refused unless it lies strictly inside the workspace and is
 * not the bare `dist/` root, so a misconfigured `outputPath` that collapsed to
 * the workspace root, an ancestor, `/`, or `<workspaceRoot>/dist` can never
 * remove the repository or every library's output at once. A non-existent
 * directory is a no-op.
 *
 * @param context - Resolved build context supplying `outputPath` and `workspaceRoot`.
 * @throws {Error} When `outputPath` is the workspace root, an ancestor of it,
 * outside the workspace, or the bare `dist/` root: anything broader than a
 * single project's output directory.
 *
 * @example Cleaning a library's output before the bundle phase
 * ```typescript
 * cleanOutputPath(context) // removes dist/libs/<project>, leaves the rest of dist/ intact
 * ```
 */
export const cleanOutputPath = (context: BuildContext): void => {
  const { outputPath, workspaceRoot } = context
  // why: outputPath is safe only when it sits strictly inside the workspace (so the path back up to workspaceRoot starts with `..`) and is not the bare dist root. That rejects the workspace root, any ancestor, `/`, and `<workspaceRoot>/dist`, leaving only a per-project subtree like dist/libs/<project> — so a clean can never widen to the whole repo or every library's output.
  const insideWorkspace = relativePath(outputPath, workspaceRoot).startsWith('..')
  if (!insideWorkspace || outputPath === join(workspaceRoot, 'dist')) {
    throw createError(
      `build: refusing to clean outputPath "${outputPath}" — a clean must target a single project's own output directory under dist/ (e.g. dist/libs/<project>), never the workspace root, an ancestor, or the bare dist/ root.`
    )
  }
  if (exists(outputPath)) removeDirectory(outputPath, { recursive: true, force: true })
}
