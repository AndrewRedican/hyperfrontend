/**
 * The advice the dependency checks add: why a dependency is wrong (a mutable ref, an outer
 * value, the whole `props` object, a callback prop, a value a state update could read), and
 * the declared values that change on every render because the component builds them anew.
 *
 * @module rules/react-hooks/shared/advice
 */

import type { Node } from '../../../code/model.ts'
import type { Reference, Scope, Variable } from '../../../scope/model.ts'
import type { Check, Declared, Used } from './check.ts'
import type { Recommendation } from './dependencies.ts'
import { positionAt } from '../../../text/lines.ts'
import { constructionKindOf } from './dependencies.ts'

/** A state update a missing dependency could be read in instead. */
interface StateAdvice {
  /** The missing dependency. */
  readonly dependency: string
  /** The setter's name. */
  readonly setter: string
  /** Which update form is advised. */
  readonly form: 'updater' | 'reducer' | 'inlineReducer'
}

/**
 * The sentence added to a dependency report, or an empty string.
 *
 * @param check - The callback's check
 * @param result - The comparison of used and declared paths
 * @param external - The declared paths rooted outside the component
 * @returns The sentence, with its leading space
 */
export function extraWarningOf(check: Check, result: Recommendation, external: ReadonlySet<string>): string {
  if (result.unnecessary.size > 0) {
    const ref = [...result.unnecessary].find((key) => key.endsWith('.current'))
    if (ref !== undefined)
      return ` Mutable values like '${ref}' aren't valid dependencies because mutating them doesn't re-render the component.`
    const outer = [...external][0]
    if (outer !== undefined && !check.scope.set.has(outer)) {
      return ` Outer scope values like '${outer}' aren't valid dependencies because mutating them doesn't re-render the component.`
    }
  }
  if (result.missing.has('props') && (check.used.get('props') as Used).references.every(isMemberObject)) {
    const name = check.hook.name
    return ` However, 'props' will change when *any* prop changes, so the preferred fix is to destructure the 'props' object outside of the ${name} call and refer to those specific props inside ${check.source(check.hook.callee)}.`
  }
  if (result.missing.size === 0) return ''
  const callback = [...result.missing].find((key) => isCallbackProp(check, key))
  if (callback !== undefined) {
    return ` If '${callback}' changes too often, find the parent component that defines it and wrap that definition in useCallback.`
  }
  const advice = stateAdviceOf(check, result.missing)
  if (advice === null) return ''
  const { dependency, setter } = advice
  if (advice.form === 'reducer') {
    return ` You can also replace multiple useState variables with useReducer if '${setter}' needs the current value of '${dependency}'.`
  }
  if (advice.form === 'inlineReducer') {
    return ` If '${setter}' needs the current value of '${dependency}', you can also switch to useReducer instead of useState and read '${dependency}' in the reducer.`
  }
  return ` You can also do a functional update '${setter}(${dependency.slice(0, 1)} => ...)' if you only need '${dependency}' in the '${setter}' call.`
}

/**
 * Whether a reference's identifier is the object of a member read.
 *
 * @param reference - The reference to `props`
 * @returns Whether it reads a property of the value
 */
function isMemberObject(reference: Reference): boolean {
  return (reference.identifier.parent as Node).kind === 'MemberExpression'
}

/**
 * Whether a missing dependency is a destructured prop the callback calls.
 *
 * @param check - The callback's check, for the component scope and used paths
 * @param key - The missing path
 * @returns Whether it is a callback received as a parameter
 */
function isCallbackProp(check: Check, key: string): boolean {
  const variable = check.component.set.get(key)
  const references = (check.used.get(key) as Used).references
  if (variable === undefined || (references[0] as Reference).resolved !== variable) return false
  if (variable.defs[0]?.kind !== 'Parameter') return false
  return references.some((reference) => {
    const parent = reference.identifier.parent as Node
    return parent.kind === 'CallExpression' && parent.callee === reference.identifier
  })
}

/**
 * The state update form advised for the first missing dependency read in a setter's argument.
 *
 * @param check - The callback's check
 * @param missing - The missing paths
 * @returns The advice, or null
 */
function stateAdviceOf(check: Check, missing: ReadonlySet<string>): StateAdvice | null {
  for (const dependency of missing) {
    for (const reference of (check.used.get(dependency) as Used).references) {
      for (let node = reference.identifier.parent; node !== null && node !== check.component.block; node = node.parent) {
        const state = node.kind === 'CallExpression' ? check.stableValues.stateOf(node.callee as Node) : undefined
        if (state === undefined) continue
        const setter = (node.callee as Node).name as string
        if (state.name === dependency) return { dependency, setter, form: 'updater' }
        if (check.stableValues.isStateRead(reference.identifier)) return { dependency, setter, form: 'reducer' }
        if ((reference.resolved as Variable).defs[0]?.kind === 'Parameter') return { dependency, setter, form: 'inlineReducer' }
        break
      }
    }
  }
  return null
}

/**
 * Reports the declared values the component builds anew on every render: functions, objects,
 * arrays, classes and the like declared in its scope.
 *
 * @param check - The callback's check
 * @param declared - The declared paths
 * @param deps - The dependency array argument
 */
export function checkConstructions(check: Check, declared: readonly Declared[], deps: Node): void {
  const name = check.hook.name
  const line = positionAt(check.context.file.lines, deps.start).line
  for (const { key } of declared) {
    const variable = check.component.variables.find((candidate) => candidate.name === key)
    const definition = variable?.defs[0]
    if (variable === undefined || definition === undefined) continue
    const node = definition.node
    let kind: string | null = null
    if (definition.kind === 'Variable' && (node.id as Node).kind === 'Identifier' && node.init !== null)
      kind = constructionKindOf(node.init as Node)
    else if (definition.kind === 'FunctionName' && node.kind === 'FunctionDeclaration') kind = 'function'
    else if (definition.kind === 'ClassName' && node.kind === 'ClassDeclaration') kind = 'class'
    if (kind === null) continue
    const wrapper = kind === 'function' ? 'useCallback' : 'useMemo'
    const what = kind === 'function' ? 'definition' : 'initialization'
    const label = definition.name.name as string
    const fallback = `wrap the ${what} of '${label}' in its own ${wrapper}() Hook.`
    const advice = isUsedOutside(variable, check.scope, deps)
      ? `To fix this, ${fallback}`
      : `Move it inside the ${name} callback. Alternatively, ${fallback}`
    const causation = kind === 'conditional' || kind === 'logical expression' ? 'could make' : 'makes'
    check.report(
      node,
      `The '${label}' ${kind} ${causation} the dependencies of ${name} Hook (at line ${line}) change on every render. ${advice}`
    )
  }
}

/**
 * Whether a value is used outside the hook's callback and its array, or assigned twice.
 *
 * @param variable - The declared variable
 * @param scope - The callback's scope
 * @param deps - The dependency array argument
 * @returns Whether moving it into the callback would not do
 */
function isUsedOutside(variable: Variable, scope: Scope, deps: Node): boolean {
  let written = false
  for (const reference of variable.references) {
    if (reference.writeExpr !== null) {
      if (written) return true
      written = true
      continue
    }
    let current: Scope | null = reference.from
    while (current !== null && current !== scope) current = current.upper
    const identifier = reference.identifier
    if (current === null && (identifier.start < deps.start || identifier.end > deps.end)) return true
  }
  return false
}
