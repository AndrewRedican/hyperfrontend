/**
 * A JSX element whose name, or the root object of whose member name, is declared nowhere in
 * reach is reported. Lower-case names are DOM tags and namespaced names are left alone. Reach is
 * the scopes from the element out to the module (the global scope too in a file without imports
 * or exports), plus that outermost scope's first child scope and the first child of that.
 *
 * @module rules/react/jsx-no-undef
 */

import type { Node } from '../../code/model'
import type { Scope } from '../../scope/model'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule'
import { scopeAnalysisOf, scopeOf } from '../../scope/analysis'

/** The statements that make a file a module. */
const MODULE_STATEMENTS = createSet<string>([
  'ImportDeclaration',
  'ExportNamedDeclaration',
  'ExportDefaultDeclaration',
  'ExportAllDeclaration',
  'TSExportAssignment',
])

/**
 * Whether the scope reached, or one of the scopes the lookup adds, declares a name.
 *
 * @param from - The innermost scope of the element
 * @param name - The name looked up
 * @param module - Whether the file imports or exports, which keeps the global scope out of reach
 * @returns Whether the name is declared in reach
 */
function isDeclared(from: Scope, name: string, module: boolean): boolean {
  let scope = from
  const declares = (candidate: Scope | undefined): boolean => candidate !== undefined && candidate.set.has(name)
  while (!declares(scope) && scope.kind !== 'module' && scope.upper !== null) scope = scope.upper
  if (declares(scope)) return true
  if (!module && scope.upper !== null && declares(scope.upper)) return true
  const child = scope.children[0]
  return declares(child) || declares(child?.children[0])
}

export default defineRule<undefined, Node>({
  id: 'react/jsx-no-undef',
  language: 'code',
  fixable: false,
  create(context) {
    const module = (context.tree.body as readonly Node[]).some((statement) => MODULE_STATEMENTS.has(statement.kind))
    return {
      JSXOpeningElement(node) {
        let name = node.name as Node
        if (name.kind === 'JSXNamespacedName') return
        if (name.kind === 'JSXIdentifier') {
          const first = (name.name as string)[0] as string
          if (first >= 'a' && first <= 'z') return
        }
        while (name.kind === 'JSXMemberExpression') name = name.object as Node
        const text = name.name as string
        if (text === 'this' || isDeclared(scopeOf(scopeAnalysisOf(context), node), text, module)) return
        context.report({ start: name.start, end: name.end, message: `'${text}' is not defined.` })
      },
    }
  },
})
