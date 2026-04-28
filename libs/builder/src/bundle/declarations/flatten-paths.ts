import type { BuildContext } from '../../models'
import { cpSync, statSync } from 'node:fs'
import { ensureDir, exists, getDirname, join, readDirectory, relativePath, removeDirectory } from '@hyperfrontend/project-scope/core'

const NESTED_WORKSPACE_DIRS = ['libs', 'plugins', 'apps']

const copyRootDeclarations = (nestedSrc: string, outputPath: string): void => {
  for (const entry of readDirectory(nestedSrc)) {
    if (!entry.isFile) continue
    if (entry.name.endsWith('.d.ts') || entry.name.endsWith('.d.ts.map')) {
      cpSync(entry.path, join(outputPath, entry.name), { force: true })
    }
  }
}

const copyLibDeclarations = (nestedSrc: string, outputPath: string): void => {
  const libSrc = join(nestedSrc, 'lib')
  if (!exists(libSrc)) return
  cpSync(libSrc, join(outputPath, 'lib'), {
    recursive: true,
    force: true,
    filter: (src) => {
      const stat = statSync(src)
      if (stat.isDirectory()) return true
      return src.endsWith('.d.ts') || src.endsWith('.d.ts.map')
    },
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
 * Also copies declarations from a `lib/` folder when present (used by libraries whose
 * platform entries re-export from `../lib/*`) and removes the leftover `libs/`,
 * `plugins/`, and `apps/` folders tsc created at the output root.
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

  copyLibDeclarations(nestedDeclarations, context.outputPath)
  cleanupNestedDirs(context.outputPath)
}
