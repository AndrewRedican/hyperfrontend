/**
 * A namespace or `module Name` block groups code the way ES modules do; it is reported outside
 * definition files, where ambient namespaces describe the shape of existing globals. Global
 * augmentations and ambient modules named by a string pass.
 *
 * @module rules/typescript/no-namespace
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'
import { isDefinitionFile } from './shared/definition-files'

export default defineRule<undefined, Node>({
  id: 'typescript/no-namespace',
  language: 'code',
  fixable: false,
  create(context) {
    const definitionFile = isDefinitionFile(context.file.path)
    return {
      TSModuleDeclaration(node) {
        if (definitionFile || node.global === true || (node.id as Node).kind === 'Literal') return
        context.report({ start: node.start, end: node.end, message: 'ES2015 module syntax is preferred over namespaces.' })
      },
    }
  },
})
