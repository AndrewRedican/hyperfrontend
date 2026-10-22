/**
 * Publishable libraries declare their entry points with `exports`, never with the legacy `main`
 * field. A `main` beside `exports` is removed; a `main` alone becomes an `exports` block.
 *
 * @module rules/workspace/lib-pkg-no-main
 */

import type { JsonPropertyNode } from '@hyperfrontend/json-utils'
import type { Fix } from '../../engine/report.ts'
import type { JsonDocument, JsonTreeNode } from '../../languages/json.ts'
import { basename, dirname } from 'node:path'
import { defineRule } from '../../engine/rule.ts'
import { indentationAt, propertyOf } from '../shared/json.ts'
import { isPublishableLibrary } from './shared/project-file.ts'

const CONVERT = 'Do not use "main" field in publishable libraries. Use "exports" field instead: "exports": { ".": "./src/index.js" }'
const REMOVE = 'Remove the "main" field. The "exports" field should be used instead for modern Node.js resolution.'

export default defineRule<undefined, JsonTreeNode>({
  id: 'workspace/lib-pkg-no-main',
  language: 'json',
  fixable: true,
  create(context) {
    if (basename(context.file.path) !== 'package.json' || !isPublishableLibrary(dirname(context.file.path))) return {}
    return {
      document(node) {
        const { root } = node as JsonDocument
        if (root.kind !== 'object') return
        const main = propertyOf(root, 'main')
        if (main === null) return
        const hasExports = propertyOf(root, 'exports') !== null
        context.report({
          start: main.start,
          end: main.end,
          message: hasExports ? REMOVE : CONVERT,
          fix: hasExports ? removal(root.properties, main) : conversion(context.file.text, main),
        })
      },
    }
  },
})

/**
 * The fix that removes a property with the separator that joined it to its neighbour; `exports`
 * is always there beside it, so the property is never alone.
 *
 * @param properties - The object's properties in source order
 * @param main - The property to remove
 * @returns The fix
 */
function removal(properties: readonly JsonPropertyNode[], main: JsonPropertyNode): Fix {
  const index = properties.indexOf(main)
  return index > 0
    ? { start: properties[index - 1].end, end: main.end, text: '' }
    : { start: main.start, end: properties[1].start, text: '' }
}

/**
 * The fix that turns `main` into an `exports` block at the same indentation.
 *
 * @param text - The document
 * @param main - The `main` property
 * @returns The fix
 */
function conversion(text: string, main: JsonPropertyNode): Fix {
  const indent = indentationAt(text, main.start)
  return {
    start: main.start,
    end: main.end,
    text: `"exports": {\n${indent}  ".": ${main.value.kind === 'string' ? main.value.raw : '"./src/index.js"'}\n${indent}}`,
  }
}
