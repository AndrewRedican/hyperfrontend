/**
 * A publishable library holds an `index.ts` only where its manifest declares an entry point: the
 * main entry, or a file an export maps to. Any other barrel is reported with the entries allowed.
 *
 * @module rules/workspace/no-unwanted-barrel-files
 */

import type { Node } from '../../code/model.ts'
import { basename, dirname, join, posix, relative, resolve, sep } from 'node:path'
import { entries, values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { defineRule } from '../../engine/rule.ts'
import { projectRootOf } from './shared/locate.ts'
import { isPublishableLibrary, readPackageFile } from './shared/project-file.ts'

/**
 * The file an export target names, a condition object read through `import`, `require` and
 * `default` in that order.
 *
 * @param target - The export's value
 * @returns The path, or null
 */
function targetOf(target: unknown): string | null {
  if (typeof target === 'string') return target
  if (target === null || typeof target !== 'object') return null
  const conditions = target as Readonly<Record<string, unknown>>
  const chosen = conditions['import'] ?? conditions['require'] ?? conditions['default']
  return typeof chosen === 'string' ? chosen : null
}

/**
 * What the report says is allowed.
 *
 * @param exports - The manifest's exports
 * @returns The allowed entries, or a note that only the main entry is
 */
function allowedText(exports: Readonly<Record<string, unknown>> | null): string {
  const listed = exports === null ? [] : entries(exports)
  if (listed.length === 0)
    return 'This library has no "exports" field in package.json, so only the main entry point (src/index.ts) is allowed.'
  const lines = listed.map(([key, value]) => `  "${key}" → ${targetOf(value)?.replace(/\.js$/, '.ts') ?? String(value)}`)
  return `Allowed entry points based on package.json exports:\n${lines.join('\n')}`
}

export default defineRule<undefined, Node>({
  id: 'workspace/no-unwanted-barrel-files',
  language: 'code',
  fixable: false,
  create(context) {
    const path = context.file.path
    if (basename(path) !== 'index.ts') return {}
    const root = projectRootOf(dirname(path))
    if (root === null || !isPublishableLibrary(root)) return {}
    const manifest = readPackageFile(root)
    if (manifest === null) return {}
    const exports =
      manifest.exports !== null && typeof manifest.exports === 'object' ? (manifest.exports as Readonly<Record<string, unknown>>) : null
    const allowed = [join(root, 'src', 'index.ts')]
    for (const value of exports === null ? [] : values(exports)) {
      const target = targetOf(value)
      if (target !== null) allowed.push(join(root, posix.normalize(target).replace(/\.(js|cjs|mjs)$/, '.ts')))
    }
    if (allowed.some((entry) => resolve(entry) === resolve(path))) return {}
    const shown = relative(root, path).split(sep).join(posix.sep)
    return {
      Program(node) {
        context.report({
          start: node.start,
          end: node.end,
          message: `Unexpected barrel file: "${shown}".\nThis library only allows index.ts files for declared entry points.\n\n${allowedText(exports)}\n\nTo fix: Either delete this barrel file (and update imports to reference implementation files directly), or add a corresponding export to package.json.`,
        })
      },
    }
  },
})
