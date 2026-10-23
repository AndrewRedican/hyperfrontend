/**
 * A class and an interface of one name merge: the interface's members become part of the
 * class's type without the class implementing them, so instances lack them at runtime. Both
 * declarations are reported.
 *
 * @module rules/typescript/no-unsafe-declaration-merging
 */

import type { Node } from '../../code/model'
import type { Scope } from '../../scope/model'
import { defineRule } from '../../engine/rule'
import { scopeAnalysisOf, scopeOf } from '../../scope/analysis'

export default defineRule<undefined, Node>({
  id: 'typescript/no-unsafe-declaration-merging',
  language: 'code',
  fixable: false,
  create(context) {
    const analysis = scopeAnalysisOf(context)
    const check = (scope: Scope, id: Node, unsafeKind: string): void => {
      const variable = scope.set.get(id.name as string)
      if (variable === undefined || variable.defs.length <= 1 || !variable.defs.some((def) => def.node.kind === unsafeKind)) return
      context.report({ start: id.start, end: id.end, message: 'Unsafe declaration merging between classes and interfaces.' })
    }
    return {
      ClassDeclaration(node) {
        const id = node.id as Node | null
        if (id === null) return
        // why: the class opens a scope of its own; the merged declarations sit in the one around it.
        check(scopeOf(analysis, node).upper as Scope, id, 'TSInterfaceDeclaration')
      },
      TSInterfaceDeclaration(node) {
        // why: the scope looked at is the one the declaration sits in, which for a generic interface is its own type-parameter scope.
        check(scopeOf(analysis, node), node.id as Node, 'ClassDeclaration')
      },
    }
  },
})
