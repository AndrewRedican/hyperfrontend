/**
 * `undefined`, `NaN`, `Infinity`, `arguments` and `eval` are names every reader takes for the
 * language's; a declaration of one shadows it and misleads. An `undefined` declared without a
 * value and never assigned passes, as it is `undefined` all the same.
 *
 * @module rules/javascript/no-shadow-restricted-names
 */

import type { Node } from '../../code/model.ts'
import type { Variable } from '../../scope/model.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule.ts'
import { scopeAnalysisOf } from '../../scope/analysis.ts'

/** The rule's options; the workspace runs the rule with `globalThis` unrestricted, the only mode implemented. */
export interface NoShadowRestrictedNamesOptions {
  /** Whether `globalThis` is restricted too; only `false`, the default, is implemented. */
  readonly reportGlobalThis?: false
}

/** The names that are not to be shadowed. */
const RESTRICTED = createSet<string>(['undefined', 'NaN', 'Infinity', 'arguments', 'eval'])

export default defineRule<NoShadowRestrictedNamesOptions | undefined, Node>({
  id: 'no-shadow-restricted-names',
  language: 'code',
  fixable: false,
  create(context) {
    // why: a class name is declared in two scopes; its one identifier is reported once.
    const reported = createSet<Node>()
    const check = (node: Node): void => {
      for (const variable of scopeAnalysisOf(context).declaredVariables(node)) {
        if (!RESTRICTED.has(variable.name) || shadowsUndefinedSafely(variable)) continue
        for (const def of variable.defs) {
          if (reported.has(def.name)) continue
          reported.add(def.name)
          context.report({ start: def.name.start, end: def.name.end, message: `Shadowing of global property '${variable.name}'.` })
        }
      }
    }
    return {
      VariableDeclaration: check,
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
      CatchClause: check,
      ImportDeclaration: check,
      ClassDeclaration: check,
      ClassExpression: check,
    }
  },
})

/**
 * Whether a variable named `undefined` holds nothing else: every declaration leaves it
 * uninitialised and nothing writes it.
 *
 * @param variable - The variable tested
 * @returns Whether it may stand
 */
function shadowsUndefinedSafely(variable: Variable): boolean {
  return (
    variable.name === 'undefined' &&
    variable.references.every((ref) => !ref.isWrite()) &&
    variable.defs.every((def) => def.kind === 'Variable' && def.node.init === null)
  )
}
