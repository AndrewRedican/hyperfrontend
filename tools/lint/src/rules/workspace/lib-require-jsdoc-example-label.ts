/**
 * Every `@example` block of a publishable library's exported API names what it shows on its
 * own line: `@example Basic usage`, not a bare tag or a tag followed by a fence.
 *
 * @module rules/workspace/lib-require-jsdoc-example-label
 */

import type { Node } from '@hyperfrontend/linter'
import { dirname } from 'node:path'
import { defineRule } from '@hyperfrontend/linter'
import { exampleTagAt, exportedApiListeners } from './shared/exported-api.ts'
import { projectRootOf } from './shared/locate.ts'
import { isPublishableLibrary } from './shared/project-file.ts'

/** What the rule reports for an example without a label. */
const MESSAGE =
  '@example blocks must include a descriptive label on the same line (e.g., "@example Basic usage"). Labels help readers understand what each example demonstrates.'

/**
 * Whether a line's `@example` tag goes without a label.
 *
 * @param line - The comment line
 * @returns Whether the line holds a tag with nothing but a fence or space after it
 */
function isUnlabelled(line: string): boolean {
  const content = line.replace(/^\s*\*\s?/, '')
  const at = exampleTagAt(content)
  if (at === -1) return false
  const label = content.slice(at + 8).trim()
  return label === '' || label.startsWith('```')
}

export default defineRule<undefined, Node>({
  id: 'workspace/lib-require-jsdoc-example-label',
  language: 'code',
  fixable: false,
  create(context) {
    const root = projectRootOf(dirname(context.file.path))
    if (root === null || !isPublishableLibrary(root)) return {}
    return exportedApiListeners(context, ({ jsdoc }) => {
      if (jsdoc !== null && jsdoc.text.split(/\r?\n/).some(isUnlabelled))
        context.report({ start: jsdoc.start, end: jsdoc.end, message: MESSAGE })
    })
  },
})
