/**
 * Commands run through `execFileSync`, never `execSync`: an argument list never passes through a
 * shell, so nothing in it is parsed or injected.
 *
 * @module rules/conventions/prefer-exec-file-sync
 */

import type { Node } from '../../code/model'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule'

/** The modules of the child process API. */
const MODULES = createSet(['child_process', 'node:child_process'])

/** Why the other function is preferred. */
const REASON = "Use 'execFileSync' instead for safer command execution (prevents shell injection and avoids shell parsing issues)."

/**
 * Whether a node is a `require` of the child process module.
 *
 * @param node - An expression that may be a require call
 * @returns Whether it is
 */
function isRequire(node: Node | null | undefined): boolean {
  if (node?.kind !== 'CallExpression' || (node.callee as Node).kind !== 'Identifier' || (node.callee as Node).name !== 'require')
    return false
  const argument = (node.arguments as readonly Node[])[0]
  return argument?.kind === 'Literal' && MODULES.has(argument.value as string)
}

export default defineRule<undefined, Node>({
  id: 'prefer-exec-file-sync',
  language: 'code',
  fixable: false,
  create(context) {
    const namespaces = createSet<string>()
    const direct = (node: Node): void => context.report({ start: node.start, end: node.end, message: `Avoid using 'execSync'. ${REASON}` })
    return {
      ImportDeclaration(node) {
        if (!MODULES.has((node.source as Node).value as string)) return
        for (const specifier of node.specifiers as readonly Node[]) {
          if (specifier.kind !== 'ImportSpecifier') namespaces.add((specifier.local as Node).name as string)
          else if (((specifier.imported as Node).name ?? (specifier.imported as Node).value) === 'execSync') direct(specifier)
        }
      },
      VariableDeclarator(node) {
        if (!isRequire(node.init as Node | null)) return
        const id = node.id as Node
        if (id.kind === 'Identifier') {
          namespaces.add(id.name as string)
          return
        }
        if (id.kind !== 'ObjectPattern') return
        for (const property of id.properties as readonly Node[]) {
          const key = property.key as Node | undefined
          if (property.kind === 'Property' && key?.kind === 'Identifier' && key.name === 'execSync') direct(property)
        }
      },
      MemberExpression(node) {
        const object = node.object as Node
        if (object.kind !== 'Identifier' || !namespaces.has(object.name as string)) return
        const property = node.property as Node
        const name = node.computed === true ? property.value : property.name
        if (name !== 'execSync') return
        context.report({ start: node.start, end: node.end, message: `Avoid using 'execSync' via namespace access. ${REASON}` })
      },
    }
  },
})
