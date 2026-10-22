/**
 * A class declares its constructor with `constructor`, an interface its construct signature with
 * `new`; a class method named `new` that returns the class, or an interface member named
 * `constructor` or a construct signature returning the interface, has the two confused.
 *
 * @module rules/typescript/no-misused-new
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'

export default defineRule<undefined, Node>({
  id: 'typescript/no-misused-new',
  language: 'code',
  fixable: false,
  create: (context) => ({
    TSConstructSignatureDeclaration(node) {
      const body = node.parent as Node
      if (body.kind !== 'TSInterfaceBody' || !returnsOwner(node.returnType, body.parent as Node)) return
      context.report({ start: node.start, end: node.end, message: 'Interfaces cannot be constructed, only classes.' })
    },
    TSMethodSignature(node) {
      const key = node.key as Node
      if (key.kind !== 'Identifier' || key.name !== 'constructor') return
      context.report({ start: node.start, end: node.end, message: 'Interfaces cannot be constructed, only classes.' })
    },
    MethodDefinition(node) {
      const key = node.key as Node
      const value = node.value as Node
      if (key.kind !== 'Identifier' || key.name !== 'new' || value.kind !== 'TSEmptyBodyFunctionExpression') return
      if (!returnsOwner(value.returnType, (node.parent as Node).parent as Node)) return
      context.report({ start: node.start, end: node.end, message: 'Class cannot have method named `new`.' })
    },
  }),
})

/**
 * Whether a return type names the class or interface the member sits in.
 *
 * @param returnType - The member's return type annotation, or undefined when it has none
 * @param owner - The class or interface declaration
 * @returns Whether the return type is a plain reference to the owner's name
 */
function returnsOwner(returnType: Node | undefined, owner: Node): boolean {
  const id = owner.id as Node | null
  if (id === null || returnType === undefined) return false
  const type = returnType.typeAnnotation as Node
  if (type.kind !== 'TSTypeReference') return false
  const name = type.typeName as Node
  return name.kind === 'Identifier' && name.name === id.name
}
