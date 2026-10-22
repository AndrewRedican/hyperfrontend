/**
 * Every exported function and class of a publishable library documents its use with an
 * `@example` block.
 *
 * @module rules/workspace/lib-require-jsdoc-example
 */

import type { Node } from '../../code/model.ts'
import { dirname } from 'node:path'
import { defineRule } from '../../engine/rule.ts'
import { exampleTagAt, exportedApiListeners } from './shared/exported-api.ts'
import { projectRootOf } from './shared/locate.ts'
import { isPublishableLibrary } from './shared/project-file.ts'

/** What the rule reports for exported API without an example. */
const MESSAGE =
  'Exported API must include an @example block in its JSDoc comment. Examples improve documentation quality and help users understand usage patterns.'

export default defineRule<undefined, Node>({
  id: 'workspace/lib-require-jsdoc-example',
  language: 'code',
  fixable: false,
  create(context) {
    const root = projectRootOf(dirname(context.file.path))
    if (root === null || !isPublishableLibrary(root)) return {}
    return exportedApiListeners(context, ({ node, jsdoc }) => {
      if (jsdoc === null || exampleTagAt(jsdoc.text) === -1) context.report({ start: node.start, end: node.end, message: MESSAGE })
    })
  },
})
