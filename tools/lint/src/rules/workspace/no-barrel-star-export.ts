/**
 * The entry point of a publishable library names what it exports: a star export would publish
 * whatever its source happens to hold. An `index.ts` is an entry point when the library's
 * manifest maps an export to it.
 *
 * @module rules/workspace/no-barrel-star-export
 */

import type { Node } from '@hyperfrontend/linter'
import { basename, dirname, resolve } from 'node:path'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { defineRule } from '@hyperfrontend/linter'
import { projectRootOf } from './shared/locate.ts'
import { isPublishableLibrary, readPackageFile } from './shared/project-file.ts'
import { sourceOf } from './shared/sources.ts'

/**
 * The target a conditional export resolves to: `import`, else `require`, else `default`.
 *
 * @param value - One value of the exports map
 * @returns The target, or whatever a plain value is
 */
function conditionTarget(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value
  const conditions = value as Readonly<Record<string, unknown>>
  return conditions['import'] ?? conditions['require'] ?? conditions['default'] ?? null
}

/**
 * The paths a manifest's exports map points at, relative to the package.
 *
 * @param exports - The `exports` field
 * @returns The string targets, conditions resolved
 */
function exportTargets(exports: unknown): string[] {
  if (typeof exports === 'string') return [exports]
  if (typeof exports !== 'object' || exports === null) return []
  return values(exports as Readonly<Record<string, unknown>>).flatMap((value) => {
    const target = conditionTarget(value)
    return typeof target === 'string' ? [target] : []
  })
}

/**
 * Whether a file is an entry point: an `index.ts` of a publishable library that the manifest's
 * exports map names, its `.js`, `.mjs` or `.cjs` read as the `.ts` source.
 *
 * @param file - The absolute path
 * @returns True when the library publishes the file as an entry
 */
function isEntryPoint(file: string): boolean {
  if (basename(file) !== 'index.ts') return false
  const root = projectRootOf(dirname(file))
  if (root === null || !isPublishableLibrary(root)) return false
  const manifest = readPackageFile(root)
  if (manifest === null) return false
  return exportTargets(manifest.exports).some((target) => resolve(root, target.replace(/\.(m?js|cjs)$/, '.ts')) === resolve(file))
}

export default defineRule<undefined, Node>({
  id: 'workspace/no-barrel-star-export',
  language: 'code',
  fixable: false,
  create(context) {
    let entry: boolean | null = null
    return {
      ExportAllDeclaration(node) {
        if (entry === null) entry = isEntryPoint(context.file.path)
        if (!entry) return
        const source = sourceOf(node)
        const message =
          node.exportKind === 'type'
            ? `Star type exports (\`export type * from "${source}"\`) are not allowed in entry point files. Use explicit named exports instead: \`export type { Type1, Type2 } from "${source}"\`.`
            : `Star exports (\`export * from "${source}"\`) are not allowed in entry point files. Use explicit named exports instead: \`export { name1, name2 } from "${source}"\`.`
        context.report({ start: node.start, end: node.end, message })
      },
    }
  },
})
