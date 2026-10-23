/**
 * The dependency array of an effect, memo, callback or imperative-handle hook must list every
 * value from the component's render scope its callback reads, and nothing it does not need.
 * Reported: missing, unnecessary and duplicate dependencies, arrays that cannot be checked,
 * values that change on every render, assignments lost after a render, `ref.current` read in
 * an effect cleanup, async effects, state set without an array, and hooks given no callback.
 *
 * @module rules/react-hooks/exhaustive-deps
 */

import type { Node } from '../../code/model'
import type { RuleContext } from '../../engine/rule'
import type { Reference, Scope, Variable } from '../../scope/model'
import type { Check, CleanupRead, Declared, HookCall, Used } from './shared/check'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule'
import { scopeAnalysisOf, scopeOf } from '../../scope/analysis'
import { checkConstructions, extraWarningOf } from './shared/advice'
import { dependencyOf, joinEnglish, propertyPathOf, recommend } from './shared/dependencies'
import { StableValues } from './shared/stable-values'

/** The advice given when an async function is passed to an effect. */
const ASYNC_ADVICE = [
  'Effect callbacks are synchronous to prevent race conditions. Put the async function inside:',
  '',
  'useEffect(() => {',
  '  async function fetchData() {',
  '    // You can await here',
  '    const response = await MyAPI.getData(someId);',
  '    // ...',
  '  }',
  '  fetchData();',
  "}, [someId]); // Or [] if effect doesn't need props or state",
  '',
  'Learn more about data fetching with Hooks: https://react.dev/link/hooks-data-fetching',
].join('\n')

/**
 * The callee without a `React.` namespace.
 *
 * @param callee - The hook call's callee as written
 * @returns The hook's own name node
 */
function withoutNamespace(callee: Node): Node {
  if (callee.kind !== 'MemberExpression' || callee.computed === true) return callee
  const object = callee.object as Node
  const property = callee.property as Node
  return object.kind === 'Identifier' && object.name === 'React' && property.kind === 'Identifier' ? property : callee
}

/**
 * The position of the callback among a hook's arguments: 0 for the effect, memo and callback
 * hooks, 1 for `useImperativeHandle`, -1 for any other call.
 *
 * @param callee - The call's callee, bare or off `React`
 * @returns The callback's index, or -1 for a call not checked
 */
function callbackIndexOf(callee: Node): number {
  const node = withoutNamespace(callee)
  if (node.kind !== 'Identifier') return -1
  if (['useEffect', 'useLayoutEffect', 'useCallback', 'useMemo'].includes(node.name as string)) return 0
  return node.name === 'useImperativeHandle' ? 1 : -1
}

/**
 * The message part naming dependencies of one kind, or null when there are none.
 *
 * @param paths - The paths, formatted as the message prints them
 * @param article - `a` or `an`, for a single one
 * @param label - `missing`, `unnecessary` or `duplicate`
 * @param verb - The fix the message asks for: `include`, `exclude` or `omit`
 * @returns The part, or null
 */
function listOf(paths: readonly string[], article: string, label: string, verb: string): string | null {
  if (paths.length === 0) return null
  const several = paths.length > 1
  const names = joinEnglish(paths.map((path) => `'${path}'`))
  return `${several ? '' : `${article} `}${label} ${several ? 'dependencies' : 'dependency'}: ${names}. Either ${verb} ${several ? 'them' : 'it'} or remove the dependency array.`
}

export default defineRule<undefined, Node>({
  id: 'react-hooks/exhaustive-deps',
  language: 'code',
  fixable: false,
  create(context) {
    const stableValues = new StableValues()
    const source = (node: Node): string => context.file.text.slice(node.start, node.end)
    const report = (node: Node, message: string): void => context.report({ start: node.start, end: node.end, message })
    const visit = (callback: Node, hook: HookCall): void => checkCallback(context, stableValues, callback, hook, report, source)
    return {
      CallExpression(node) {
        const callee = node.callee as Node
        const index = callbackIndexOf(callee)
        if (index === -1) return
        const args = node.arguments as readonly Node[]
        const name = withoutNamespace(callee).name as string
        const given = args[index + 1]
        const deps = given === undefined || (given.kind === 'Identifier' && given.name === 'undefined') ? null : given
        const hook: HookCall = { callee, name, deps, isEffect: name.endsWith('Effect') }
        let callback = args[index]
        if (callback === undefined) {
          report(callee, `React Hook ${name} requires an effect callback. Did you forget to pass a callback to the hook?`)
          return
        }
        if (deps === null && !hook.isEffect) {
          if (name === 'useMemo' || name === 'useCallback') {
            report(
              callee,
              `React Hook ${name} does nothing when called with only one argument. Did you forget to pass an array of dependencies?`
            )
          }
          return
        }
        while (callback.kind === 'TSAsExpression') callback = callback.expression as Node
        if (callback.kind === 'FunctionExpression' || callback.kind === 'ArrowFunctionExpression') {
          visit(callback, hook)
          return
        }
        if (callback.kind !== 'Identifier') {
          report(callee, `React Hook ${name} received a function whose dependencies are unknown. Pass an inline function instead.`)
          return
        }
        if (deps === null) return
        const elements = (deps.elements ?? []) as readonly (Node | null)[]
        if (elements.some((element) => element?.kind === 'Identifier' && element.name === callback.name)) return
        const variable = scopeOf(scopeAnalysisOf(context), node).set.get(callback.name as string)
        if (variable === undefined) return
        const target = definedFunctionOf(variable)
        if (target !== null) {
          visit(target, hook)
          return
        }
        report(
          callee,
          `React Hook ${name} has a missing dependency: '${callback.name as string}'. Either include it or remove the dependency array.`
        )
      },
    }
  },
})

/**
 * The function a callback variable is declared as: a function declaration, or a declarator
 * initialised with a function.
 *
 * @param variable - The variable passed as the callback
 * @returns The function, or null when it is declared otherwise
 */
function definedFunctionOf(variable: Variable): Node | null {
  const definition = variable.defs[0]
  if (definition === undefined || (definition.kind !== 'Variable' && definition.kind !== 'FunctionName')) return null
  const declared = definition.node
  if (declared.kind === 'FunctionDeclaration') return declared
  const init = declared.init as Node | null | undefined
  if (init === null || init === undefined) return null
  return init.kind === 'ArrowFunctionExpression' || init.kind === 'FunctionExpression' ? init : null
}

/**
 * Checks one hook callback against its dependency array.
 *
 * @param context - The rule's context
 * @param stableValues - The stability verdicts shared by the file's hooks
 * @param callback - The callback function
 * @param hook - The hook call
 * @param report - Reports a problem on a node
 * @param source - The text of a node
 */
function checkCallback(
  context: RuleContext<undefined, Node>,
  stableValues: StableValues,
  callback: Node,
  hook: HookCall,
  report: (node: Node, message: string) => void,
  source: (node: Node) => string
): void {
  if (hook.isEffect && callback.async === true) report(callback, ASYNC_ADVICE)
  const scope = scopeAnalysisOf(context).scopesOf(callback)[0] as Scope
  const pure = createSet<Scope>()
  let component: Scope | null = scope.upper
  while (component !== null) {
    pure.add(component)
    if (component.kind === 'function') break
    component = component.upper
  }
  if (component === null) return
  const check: Check = {
    context,
    stableValues,
    hook,
    callback,
    scope,
    component,
    used: createMap<string, Used>(),
    optional: createMap<string, boolean>(),
    stable: createSet<string>(),
    report,
    source,
  }
  const cleanup = gather(check, pure)
  for (const [key, read] of cleanup) {
    if ((read.reference.resolved as Variable).references.some((reference) => isCurrentAssignment(reference.identifier))) continue
    report(
      read.property,
      `The ref value '${key}.current' will likely have changed by the time this effect cleanup function runs. If this ref points to a node rendered by React, copy '${key}.current' to a variable inside the effect, and use that variable in the cleanup function.`
    )
  }
  const stale = createSet<string>()
  for (const [key, entry] of check.used) {
    if (entry.stable) check.stable.add(key)
    for (const reference of entry.references) {
      if (reference.writeExpr === null || stale.has(key)) continue
      stale.add(key)
      const name = source(hook.callee)
      report(
        reference.writeExpr,
        `Assignments to the '${key}' variable from inside React Hook ${name} will be lost after each render. To preserve the value over time, store it in a useRef Hook and keep the mutable value in the '.current' property. Otherwise, you can move this variable directly inside ${name}.`
      )
    }
  }
  if (stale.size > 0) return
  if (hook.deps === null) checkWithoutArray(check)
  else checkArray(check, hook.deps)
}

/**
 * Collects the paths a callback uses from the render scope, with their references and whether
 * they are stable, and the refs whose `.current` an effect's cleanup reads.
 *
 * @param check - The callback's check, whose used paths are filled in
 * @param pure - The scopes whose values may change between renders
 * @returns The cleanup reads, by ref path
 */
function gather(check: Check, pure: ReadonlySet<Scope>): Map<string, CleanupRead> {
  const cleanup = createMap<string, CleanupRead>()
  const visit = (current: Scope): void => {
    for (const reference of current.references) {
      const resolved = reference.resolved
      if (resolved === null || !pure.has(resolved.scope)) continue
      const dependency = dependencyOf(reference.identifier)
      const key = propertyPathOf(dependency, check.optional) as string
      const parent = dependency.parent as Node
      if (check.hook.isEffect && dependency.kind === 'Identifier' && isCurrentRead(parent) && isInCleanup(reference, check.callback)) {
        cleanup.set(key, { reference, property: parent.property as Node })
      }
      if (parent.kind === 'TSTypeQuery' || parent.kind === 'TSTypeReference') continue
      const definition = resolved.defs[0]
      if (definition === undefined || definition.node.init === check.callback.parent) continue
      const entry = check.used.get(key)
      if (entry !== undefined) {
        entry.references.push(reference)
        continue
      }
      const stable = check.stableValues.isStable(resolved) || check.stableValues.isCaptureFree(resolved, check.component, pure)
      check.used.set(key, { stable, references: [reference] })
    }
    for (const child of current.children) visit(child)
  }
  visit(check.scope)
  return cleanup
}

/**
 * Whether a member reads `.current` plainly.
 *
 * @param member - The parent of a dependency identifier
 * @returns Whether it is `x.current`
 */
function isCurrentRead(member: Node): boolean {
  return member.kind === 'MemberExpression' && member.computed !== true && (member.property as Node).name === 'current'
}

/**
 * Whether an identifier is the object of a `.current` assignment target.
 *
 * @param identifier - The identifier of a reference
 * @returns Whether it is assigned as `x.current = ...`
 */
function isCurrentAssignment(identifier: Node): boolean {
  const member = identifier.parent as Node
  if (!isCurrentRead(member) || (member.property as Node).kind !== 'Identifier') return false
  const assignment = member.parent as Node
  return assignment.kind === 'AssignmentExpression' && assignment.left === member
}

/**
 * Whether a reference sits in a function an effect returns, or below one: the outermost
 * function between it and the effect is the argument of a return.
 *
 * @param reference - The reference to a ref, checked for its position
 * @param callback - The effect's callback
 * @returns Whether it is read during cleanup
 */
function isInCleanup(reference: Reference, callback: Node): boolean {
  let returned = false
  for (let scope = reference.from; scope.block !== callback; scope = scope.upper as Scope) {
    if (scope.kind === 'function') returned = (scope.block.parent as Node).kind === 'ReturnStatement'
  }
  return returned
}

/**
 * For an effect without an array: reports a state setter called directly in it, which loops.
 *
 * @param check - The callback's check
 */
function checkWithoutArray(check: Check): void {
  let setter: string | null = null
  for (const [key, entry] of check.used) {
    const direct = entry.references.find((reference) => {
      if (!check.stableValues.isSetterCall(reference.identifier)) return false
      let scope = reference.from
      while (scope.kind !== 'function') scope = scope.upper as Scope
      return scope.block === check.callback
    })
    if (direct === undefined) continue
    setter = key
    break
  }
  if (setter === null) return
  const { suggested } = recommend({
    used: check.used.keys(),
    declared: [],
    stable: check.stable,
    external: createSet<string>(),
    isEffect: true,
  })
  const name = check.hook.name
  check.report(
    check.hook.callee,
    `React Hook ${name} contains a call to '${setter}'. Without a list of dependencies, this can lead to an infinite chain of updates. To fix this, pass [${suggested.join(', ')}] as a second argument to the ${name} Hook.`
  )
}

/**
 * Reads the declared array: reports elements that cannot be checked, and collects the paths
 * the others declare and those rooted outside the component.
 *
 * @param check - The callback's check
 * @param deps - The dependency array argument
 * @param external - The declared paths rooted outside the component, filled in
 * @returns The declared paths, in order
 */
function declaredOf(check: Check, deps: Node, external: Set<string>): Declared[] {
  const name = check.source(check.hook.callee)
  const array = deps.kind === 'TSAsExpression' ? (deps.expression as Node) : deps
  if (array.kind !== 'ArrayExpression') {
    check.report(
      deps,
      `React Hook ${name} was passed a dependency list that is not an array literal. This means we can't statically verify whether you've passed the correct dependencies.`
    )
    return []
  }
  const declared: Declared[] = []
  for (const element of array.elements as readonly (Node | null)[]) {
    if (element === null) continue
    if (element.kind === 'SpreadElement') {
      check.report(
        element,
        `React Hook ${name} has a spread element in its dependency array. This means we can't statically verify whether you've passed the correct dependencies.`
      )
      continue
    }
    const key = propertyPathOf(element, null)
    if (key === null) {
      check.report(element, unsupportedMessage(check, element, name))
      continue
    }
    let root = element
    while (root.kind === 'MemberExpression' || root.kind === 'ChainExpression') {
      root = (root.kind === 'ChainExpression' ? (root.expression as Node).object : root.object) as Node
    }
    declared.push({ key, node: element })
    if (check.component.through.some((reference) => reference.identifier === root)) external.add(key)
  }
  return declared
}

/**
 * The message for an array element that is no property path: a literal, which never changes,
 * or a complex expression.
 *
 * @param check - The callback's check
 * @param element - The array element
 * @param name - The hook's callee text
 * @returns The message telling a constant from a complex expression
 */
function unsupportedMessage(check: Check, element: Node, name: string): string {
  if (element.kind !== 'Literal') {
    return `React Hook ${name} has a complex expression in the dependency array. Extract it to a separate variable so it can be statically checked.`
  }
  const raw = check.source(element)
  const value = element.value
  if (typeof value === 'string' && check.used.has(value)) {
    return `The ${raw} literal is not a valid dependency because it never changes. Did you mean to include ${value} in the array instead?`
  }
  return `The ${raw} literal is not a valid dependency because it never changes. You can safely remove it.`
}

/**
 * Checks the declared array against what the callback uses.
 *
 * @param check - The callback's check
 * @param deps - The dependency array argument
 */
function checkArray(check: Check, deps: Node): void {
  const external = createSet<string>()
  const declared = declaredOf(check, deps, external)
  const input = { used: check.used.keys(), declared: declared.map((entry) => entry.key), stable: check.stable, external }
  const result = recommend({ ...input, isEffect: check.hook.isEffect })
  if (result.duplicate.size + result.missing.size + result.unnecessary.size === 0) {
    checkConstructions(check, declared, deps)
    return
  }
  const format = (path: string): string => {
    const members = path.split('.')
    let text = members[0] as string
    for (let index = 1; index < members.length; index += 1) {
      text += `${check.optional.get(members.slice(0, index + 1).join('.')) === true ? '?.' : '.'}${members[index] as string}`
    }
    return text
  }
  const sorted = (paths: ReadonlySet<string>): string[] => [...paths].sort().map(format)
  const summary =
    listOf(sorted(result.missing), 'a', 'missing', 'include') ??
    listOf(sorted(result.unnecessary), 'an', 'unnecessary', 'exclude') ??
    (listOf(sorted(result.duplicate), 'a', 'duplicate', 'omit') as string)
  check.report(deps, `React Hook ${check.source(check.hook.callee)} has ${summary}${extraWarningOf(check, result, external)}`)
}
