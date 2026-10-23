/**
 * The empty object type, written `{}` or as an interface without members, accepts every value
 * but `null` and `undefined`, which is rarely what its author meant; `object` or `unknown` says
 * it. An interface extending exactly one type is reported as equivalent to that type.
 *
 * @module rules/typescript/no-empty-object-type
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'

/**
 * The lines of advice every empty-object report ends with.
 *
 * @param option - The rule option that would allow the construct
 * @returns The three lines, each starting on a line of its own
 */
function advice(option: string): string {
  return (
    `\n- If that's what you want, disable this lint rule with an inline comment or configure the '${option}' rule option.` +
    '\n- If you want a type meaning "any object", you probably want `object` instead.' +
    '\n- If you want a type meaning "any value", you probably want `unknown` instead.'
  )
}

/** The message for an interface without members or supertypes. */
const EMPTY_INTERFACE = `An empty interface declaration allows any non-nullish value, including literals like \`0\` and \`""\`.${advice('allowInterfaces')}`

/** The message for an interface without members extending one type. */
const EMPTY_INTERFACE_WITH_SUPER = 'An interface declaring no members is equivalent to its supertype.'

/** The message for `{}`. */
const EMPTY_OBJECT = `The \`{}\` ("empty object") type allows any non-nullish value, including literals like \`0\` and \`""\`.${advice('allowObjectTypes')}`

export default defineRule<undefined, Node>({
  id: 'typescript/no-empty-object-type',
  language: 'code',
  fixable: false,
  create(context) {
    return {
      TSInterfaceDeclaration(node) {
        if (((node.body as Node).body as readonly Node[]).length > 0) return
        const id = node.id as Node
        const supertypes = (node.extends as readonly Node[]).length
        if (supertypes > 1) return
        context.report({ start: id.start, end: id.end, message: supertypes === 0 ? EMPTY_INTERFACE : EMPTY_INTERFACE_WITH_SUPER })
      },
      TSTypeLiteral(node) {
        // why: `T & {}` is the idiom for a non-nullable `T`, so an intersection member passes.
        if ((node.members as readonly Node[]).length > 0 || (node.parent as Node).kind === 'TSIntersectionType') return
        context.report({ start: node.start, end: node.end, message: EMPTY_OBJECT })
      },
    }
  },
})
