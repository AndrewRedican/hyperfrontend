/**
 * The build maps each published subpath to an entry module it discovers under `src/`: the root
 * `index` or a nested directory's `index`. An export value shaped any other way names nothing
 * the build produces.
 *
 * @module rules/workspace/lib-pkg-exports-entry-shape
 */

import { basename, extname } from 'node:path'
import { propertyOf, stringsUnder } from '@hyperfrontend/linter/helpers'
import { isRelativePath, SOURCE_PREFIX } from './shared/manifest-paths.ts'
import { manifestRule } from './shared/manifest-rule.ts'

/**
 * Whether a path names an entry module: `./src/index.<ext>` or `./src/<dirs>/index.<ext>`,
 * declaration files included.
 *
 * @param path - The export path
 * @returns True for an entry module path
 */
function isEntryModule(path: string): boolean {
  if (!path.startsWith(SOURCE_PREFIX)) return false
  const file = basename(path)
  const extension = extname(file)
  if (extension === '') return false
  const stem = file.slice(0, -extension.length)
  return stem === 'index' || stem === 'index.d'
}

export default manifestRule('workspace/lib-pkg-exports-entry-shape', 'package.json', (root, context) => {
  const exports = propertyOf(root, 'exports')
  if (exports === null) return
  for (const node of stringsUnder(exports.value)) {
    const path = node.value
    if (path === './package.json' || path === 'package.json') continue
    if (!isRelativePath(path) || isEntryModule(path)) continue
    context.report({
      start: node.start,
      end: node.end,
      message: `Export path '${path}' is not an entry module. Point it at './src/index.<ext>' or './src/<dir>/index.<ext>': the build discovers entries only there, and fails on a subpath mapped anywhere else.`,
    })
  }
})
