/**
 * Class-style components: an ES6 class extending `Component` or `PureComponent` (bare or off the
 * pragma) and an ES5 object passed to the class factory; and the one a node sits in, found by
 * walking its scopes outward.
 *
 * @module rules/react/shared/class-components
 */

import type { Node } from '../../../code/model.ts'
import type { RuleContext } from '../../../engine/rule.ts'
import type { Scope } from '../../../scope/model.ts'
import { scopeAnalysisOf, scopeOf } from '../../../scope/analysis.ts'
import { createClassOf, pragmaOf } from './settings.ts'

/**
 * Whether a name is `Component` or `PureComponent`.
 *
 * @param name - The name tested
 * @returns Whether it names a component base class
 */
function isComponentBase(name: unknown): boolean {
  return name === 'Component' || name === 'PureComponent'
}

/**
 * Whether a class extends `Component` or `PureComponent`, bare or as a member of the pragma.
 *
 * @param context - The rule's context, for the pragma
 * @param node - The class declaration or expression
 * @returns Whether the class is an ES6 component
 */
export function isEs6Component(context: RuleContext<unknown, Node>, node: Node): boolean {
  const base = node.superClass as Node | null
  if (base === null) return false
  if (base.kind === 'Identifier') return isComponentBase(base.name)
  if (base.kind !== 'MemberExpression') return false
  return (base.object as Node).name === pragmaOf(context.file, context.settings) && isComponentBase((base.property as Node).name)
}

/**
 * Whether an object is the argument of the class factory, called bare or off the pragma.
 *
 * @param context - The rule's context, for the pragma and the factory's name
 * @param node - The object expression
 * @returns Whether the object is an ES5 component
 */
export function isEs5Component(context: RuleContext<unknown, Node>, node: Node): boolean {
  const call = node.parent as Node
  if (call.kind !== 'CallExpression') return false
  const callee = call.callee as Node
  const text = context.file.text.slice(callee.start, callee.end)
  const factory = createClassOf(context.settings)
  return text === factory || text === `${pragmaOf(context.file, context.settings)}.${factory}`
}

/**
 * The ES6 component whose class is the nearest class scope around a node.
 *
 * @param context - The rule's context
 * @param node - The node looked from
 * @returns The class, or null when the nearest class is no component or there is none
 */
export function parentEs6Component(context: RuleContext<unknown, Node>, node: Node): Node | null {
  let scope: Scope | null = scopeOf(scopeAnalysisOf(context), node)
  while (scope !== null && scope.kind !== 'class') scope = scope.upper
  if (scope === null || !isEs6Component(context, scope.block)) return null
  return scope.block
}

/**
 * The ES5 component an enclosing function is a property of, nearest first.
 *
 * @param context - The rule's context
 * @param node - The node looked from
 * @returns The component's object, or null when no enclosing scope's block is a property of one
 */
export function parentEs5Component(context: RuleContext<unknown, Node>, node: Node): Node | null {
  for (let scope: Scope | null = scopeOf(scopeAnalysisOf(context), node); scope !== null; scope = scope.upper) {
    const holder = scope.block.parent?.parent
    if (holder !== null && holder !== undefined && holder.kind === 'ObjectExpression' && isEs5Component(context, holder)) return holder
  }
  return null
}
