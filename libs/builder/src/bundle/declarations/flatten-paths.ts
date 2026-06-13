import type { BuildContext } from '../../models'
import { cpSync, statSync } from 'node:fs'
import { ensureDir, exists, getDirname, join, relativePath, removeDirectory } from '@hyperfrontend/project-scope/core'

const NESTED_WORKSPACE_DIRS = ['libs', 'plugins', 'apps']

const isDeclarationFile = (path: string): boolean => path.endsWith('.d.ts') || path.endsWith('.d.ts.map')

/**
 * Recursively copies every `.d.ts` / `.d.ts.map` under the project's nested tsc
 * `src` tree into the flat output root, preserving internal subdirectory
 * structure. The root entry's public `index.d.ts` may re-export from any
 * internal non-entry subdirectory (e.g. `./shared/consts`, `./lib/*`), so a
 * top-level-files-only copy would leave those references dangling; a later
 * `rollup-plugin-dts` flatten then fails to resolve them. Directories are always
 * traversed; tsc emits declarations only, so the file filter is a safety net.
 *
 * @param nestedSrc - Absolute path to the project's nested tsc `src` declaration tree.
 * @param outputPath - Absolute path to the flat per-library output root.
 */
const copyRootDeclarations = (nestedSrc: string, outputPath: string): void => {
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
 * The root copy is recursive, so internal non-entry subdirectories the public
 * `index.d.ts` re-exports from (e.g. `shared/`, `lib/`) are preserved rather
 * than dropped. Finally removes the leftover `libs/`, `plugins/`, and `apps/`
 * folders tsc created at the output root.
 *
 * @param context - Resolved build context. Uses `projectRoot`, `outputPath`,
 * `workspaceRoot`, and `entryPointDiscovery`.
 *
 * @example Flattening declarations after a manual tsc invocation
 * ```typescript
 * flattenDeclarationPaths(context)
 * ```
 */
export const flattenDeclarationPaths = (context: BuildContext): void => {
  const nestedDeclarations = join(context.outputPath, relativePath(context.workspaceRoot, join(context.projectRoot, 'src')))
  if (!exists(nestedDeclarations)) return

  for (const entry of context.entryPointDiscovery.entryPoints) {
    if (entry.isRoot) {
      copyRootDeclarations(nestedDeclarations, context.outputPath)
      continue
    }
    const declSrc = join(nestedDeclarations, entry.srcPath)
    const declDest = join(context.outputPath, entry.srcPath)
    if (exists(declSrc)) {
      ensureDir(getDirname(declDest))
      cpSync(declSrc, declDest, { recursive: true, force: true })
    }
  }

  cleanupNestedDirs(context.outputPath)
}
