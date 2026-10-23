/**
 * Export paths name what is published: compiled `.js`, `.mjs`, `.cjs` or `.json` files, never
 * TypeScript sources. A source extension is replaced by the compiled one.
 *
 * @module rules/workspace/lib-pkg-exports-js-only
 */

import { extname } from 'node:path'
import { propertyOf, stringsUnder } from '@hyperfrontend/linter/helpers'
import { isRelativePath } from './shared/manifest-paths.ts'
import { manifestRule } from './shared/manifest-rule.ts'

/** The extensions a published path may have. */
const VALID = ['.js', '.mjs', '.cjs', '.json']

/**
 * The compiled path a source path becomes.
 *
 * @param path - A path with a TypeScript extension
 * @returns The path with the matching JavaScript extension
 */
function compiled(path: string): string {
  if (path.endsWith('.mts')) return `${path.slice(0, -4)}.mjs`
  if (path.endsWith('.cts')) return `${path.slice(0, -4)}.cjs`
  const extension = extname(path)
  return `${extension === '' ? path : path.slice(0, -extension.length)}.js`
}

export default manifestRule(
  'workspace/lib-pkg-exports-js-only',
  'package.json',
  (root, context) => {
    const exports = propertyOf(root, 'exports')
    if (exports === null) return
    for (const node of stringsUnder(exports.value)) {
      const path = node.value
      if (!isRelativePath(path)) continue
      const extension = extname(path)
      if (VALID.includes(extension)) continue
      const suggested = compiled(path)
      context.report({
        start: node.start,
        end: node.end,
        message: `Export path '${path}' has invalid extension '${extension}'. Use '${suggested}' instead. Package.json exports should reference compiled .js files, not source files.`,
        fix: { start: node.start, end: node.end, text: `"${suggested}"` },
      })
    }
  },
  true
)
