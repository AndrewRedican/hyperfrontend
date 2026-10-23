/**
 * The wrapper object types `BigInt`, `Boolean`, `Number`, `Object`, `String` and `Symbol` are
 * rarely meant where the primitives are: a primitive is not assignable from its wrapper, and
 * `Object` admits every non-nullish value. The lower-cased primitive replaces a type reference;
 * a class or interface heritage is reported without a fix.
 *
 * @module rules/typescript/no-wrapper-object-types
 */

import type { Node } from '../../code/model'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule'
import { scopeAnalysisOf } from '../../scope/analysis'
import { isReferenceToGlobal } from './shared/references'

/** The wrapper types, each with a primitive of the same name in lower case. */
const WRAPPERS = createSet<string>(['BigInt', 'Boolean', 'Number', 'Object', 'String', 'Symbol'])

export default defineRule<undefined, Node>({
  id: 'typescript/no-wrapper-object-types',
  language: 'code',
  fixable: true,
  create(context) {
    const analysis = scopeAnalysisOf(context)
    const check = (node: Node, fixable: boolean): void => {
      if (node.kind !== 'Identifier') return
      const name = node.name as string
      if (!WRAPPERS.has(name) || !isReferenceToGlobal(analysis, node, name)) return
      const preferred = name.toLowerCase()
      context.report({
        start: node.start,
        end: node.end,
        message: `Prefer using the primitive \`${preferred}\` as a type name, rather than the upper-cased \`${name}\`.`,
        fix: fixable ? { start: node.start, end: node.end, text: preferred } : undefined,
      })
    }
    return {
      TSClassImplements: (node) => check(node.expression as Node, false),
      TSInterfaceHeritage: (node) => check(node.expression as Node, false),
      TSTypeReference: (node) => check(node.typeName as Node, true),
    }
  },
})
