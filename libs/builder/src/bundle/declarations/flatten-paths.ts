import type { BuildContext } from '../../models'
import { cpSync, statSync } from 'node:fs'
import { exists, join, relativePath, removeDirectory } from '@hyperfrontend/project-scope/core'

const NESTED_WORKSPACE_DIRS = ['libs', 'plugins', 'apps']

const isDeclarationFile = (path: string): boolean => path.endsWith('.d.ts') || path.endsWith('.d.ts.map')

/**
 * Recursively copies every `.d.ts` / `.d.ts.map` under the project's nested tsc
 * `src` tree into the flat output root, preserving internal subdirectory
 * structure. Any entry's public `index.d.ts` — root, platform (`./browser`,
 * `./node`), or feature — may re-export from a shared internal non-entry
 * subdirectory (e.g. `./shared/consts`, `./lib/*`), so copying only each entry's
 * own subtree would leave those references dangling; a later `rollup-plugin-dts`
 * flatten then fails to resolve them. Directories are always traversed; tsc
 * emits declarations only, so the file filter is a safety net.
 *
 * @param nestedSrc - Absolute path to the project's nested tsc `src` declaration tree.
 * @param outputPath - Absolute path to the flat per-library output root.
 */
const copyDeclarations = (nestedSrc: string, outputPath: string): void => {
  cpSync(nestedSrc, outputPath, {
    recursive: true,
    force: true,
    filter: (src) => statSync(src).isDirectory() || isDeclarationFile(src),
  })
}

const cleanupNestedDirs = (outputPath: string): void => {
  for (const dir of NESTED_WORKSPACE_DIRS) {
    const nested = join(outputPath, dir)
    if (exists(nested)) removeDirectory(nested, { recursive: true, force: true })
  }
}

/**
 * Reshapes the nested declaration tree produced by tsc (with `baseUrl=workspaceRoot`)
 * into the flat per-library structure consumers expect.
 *
 * Without this step tsc emits declarations at
 *   `dist/libs/<lib>/libs/<lib>/src/index.d.ts`
 * because it preserves the workspace-relative path. This primitive flattens that to
 *   `dist/libs/<lib>/index.d.ts`
 * while preserving any nested platform / feature subdirectories.
 *
 * The copy is recursive and unconditional, so internal non-entry subdirectories
 * that any entry's `index.d.ts` re-exports from (e.g. `shared/`, `lib/`) are
 * preserved rather than dropped. Per-source declarations left unreachable once
 * the per-entry pass inlines each `index.d.ts` are removed afterwards by
 * `pruneOrphanDeclarations`. Finally removes the leftover `libs/`, `plugins/`,
 * and `apps/` folders tsc created at the output root.
 *
 * @param context - Resolved build context. Uses `projectRoot`, `outputPath`,
 * and `workspaceRoot`.
 *
 * @example Flattening declarations after a manual tsc invocation
 * ```typescript
 * flattenDeclarationPaths(context)
 * ```
 */
export const flattenDeclarationPaths = (context: BuildContext): void => {
  const nestedDeclarations = join(context.outputPath, relativePath(context.workspaceRoot, join(context.projectRoot, 'src')))
  if (!exists(nestedDeclarations)) return

  copyDeclarations(nestedDeclarations, context.outputPath)
  cleanupNestedDirs(context.outputPath)
}
