/**
 * Whether a bare name reaches the React pragma's export of the same name: imported from the
 * pragma's module, destructured from the pragma or its `require`, or read off either.
 *
 * @module rules/react/shared/pragma-import
 */

import type { Node } from '../../../code/model'
import type { RuleContext } from '../../../engine/rule'
import type { Definition } from '../../../scope/model'
import { findVariable, scopeAnalysisOf, scopeOf } from '../../../scope/analysis'

/**
 * Whether the name a node uses was last defined from the pragma.
 *
 * @param context - The rule's context, for the scope analysis
 * @param node - The node the name is looked up from
 * @param name - The name, such as `createElement`
 * @param pragma - The pragma, such as `React`
 * @returns Whether the name's latest definition comes from the pragma or its module
 *
 * @example Follow an import or destructuring back to the pragma
 * ```ts
 * // import { createElement } from 'react'
 * isFromPragma(context, node, 'createElement', 'React') // => true
 * // const { memo } = require('react')
 * isFromPragma(context, node, 'memo', 'React') // => true
 * // a name nothing declares
 * isFromPragma(context, node, 'useEffect', 'React') // => false
 * ```
 */
export function isFromPragma(context: RuleContext<unknown, Node>, node: Node, name: string, pragma: string): boolean {
  const variable = findVariable(scopeOf(scopeAnalysisOf(context), node), name)
  if (variable === null || variable.defs.length === 0) return false
  const definition = variable.defs[variable.defs.length - 1] as Definition
  const module = pragma.toLocaleLowerCase()
  const declarator = definition.node
  if (declarator.kind === 'VariableDeclarator') {
    const init = declarator.init as Node | null
    if (init === null) return false
    if (init.kind === 'Identifier') return init.name === pragma
    if (init.kind === 'MemberExpression') {
      const object = init.object as Node
      if (object.kind === 'Identifier') return object.name === pragma
      return object.kind === 'CallExpression' && isRequireOf(object, module)
    }
    return init.kind === 'CallExpression' && isRequireOf(init, module)
  }
  const parent = definition.parent
  return parent !== null && parent.kind === 'ImportDeclaration' && (parent.source as Node).value === module
}

/**
 * Whether a call is `require` of a module.
 *
 * @param call - The call checked
 * @param module - The module's specifier
 * @returns Whether the call is `require(module)`
 */
function isRequireOf(call: Node, module: string): boolean {
  const callee = call.callee as Node
  const first = (call.arguments as readonly Node[])[0]
  return callee.name === 'require' && first !== undefined && first.value === module
}
