/**
 * An interface without members is `{}` or, when it extends one type, that type: the first is
 * reported as such, the second is rewritten as a type alias unless the alias would change
 * meaning, as it would for an interface merged with a class or declared ambiently.
 *
 * @module rules/typescript/no-empty-interface
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'
import { scopeAnalysisOf, scopeOf } from '../../scope/analysis.ts'
import { isDefinitionFile } from './shared/definition-files.ts'

export default defineRule<undefined, Node>({
  id: 'typescript/no-empty-interface',
  language: 'code',
  fixable: true,
  create(context) {
    const definitionFile = isDefinitionFile(context.file.path)
    return {
      TSInterfaceDeclaration(node) {
        if (((node.body as Node).body as readonly Node[]).length > 0) return
        const id = node.id as Node
        const supertypes = node.extends as readonly Node[]
        if (supertypes.length === 0) {
          context.report({ start: id.start, end: id.end, message: 'An empty interface is equivalent to `{}`.' })
          return
        }
        if (supertypes.length !== 1) return
        // why: the scope looked at is the one the declaration sits in, which for a generic interface is its own type-parameter scope.
        const scope = scopeOf(scopeAnalysisOf(context), node)
        const mergedWithClass = scope.set.get(id.name as string)?.defs.some((def) => def.node.kind === 'ClassDeclaration') === true
        const ambient = definitionFile && scope.kind === 'tsModule' && scope.block.declare === true
        const { text } = context.file
        const typeParameters = node.typeParameters === undefined ? '' : text.slice(node.typeParameters.start, node.typeParameters.end)
        const supertype = supertypes[0] as Node
        context.report({
          start: id.start,
          end: id.end,
          message: 'An interface declaring no members is equivalent to its supertype.',
          fix:
            mergedWithClass || ambient
              ? undefined
              : {
                  start: node.start,
                  end: node.end,
                  text: `type ${text.slice(id.start, id.end)}${typeParameters} = ${text.slice(supertype.start, supertype.end)}`,
                },
        })
      },
    }
  },
})
