/**
 * Every relative export path names a file that exists, or a compiled file whose TypeScript source
 * exists.
 *
 * @module rules/workspace/lib-pkg-exports-exist
 */

import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { isRelativePath, propertyOf, stringsUnder } from '../shared/json.ts'
import { manifestRule } from './shared/manifest-rule.ts'

/**
 * Whether an export path is backed by a file.
 *
 * @param directory - The library's directory
 * @param path - The export path, relative to it
 * @returns True when the file exists, or a `.js`, `.mjs` or `.cjs` path has its `.ts`, `.mts` or `.cts` source
 */
function isBacked(directory: string, path: string): boolean {
  const resolved = join(directory, path)
  if (existsSync(resolved)) return true
  if (resolved.endsWith('.mjs')) return existsSync(`${resolved.slice(0, -4)}.ts`) || existsSync(`${resolved.slice(0, -4)}.mts`)
  if (resolved.endsWith('.cjs')) return existsSync(`${resolved.slice(0, -4)}.ts`) || existsSync(`${resolved.slice(0, -4)}.cts`)
  if (resolved.endsWith('.js')) return existsSync(`${resolved.slice(0, -3)}.ts`)
  return false
}

export default manifestRule('workspace/lib-pkg-exports-exist', 'package.json', (root, context) => {
  const exports = propertyOf(root, 'exports')
  if (exports === null) return
  for (const node of stringsUnder(exports.value)) {
    const path = node.value
    if (!isRelativePath(path)) continue
    if (isBacked(dirname(context.file.path), path)) continue
    context.report({
      start: node.start,
      end: node.end,
      message: `Export path '${path}' does not exist. Ensure the file exists or remove the export entry.`,
    })
  }
})
