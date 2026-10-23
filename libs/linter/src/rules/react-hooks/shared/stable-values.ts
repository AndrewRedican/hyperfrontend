/**
 * Which render-scope values keep their identity between renders, so that a hook's array need
 * not list them: constant primitives, refs, state setters and dispatchers, transition starters,
 * and functions declared in the component that capture nothing that changes. Verdicts are
 * remembered per variable for the whole file, and so are the state setters they find.
 *
 * @module rules/react-hooks/shared/stable-values
 */

import type { Node } from '../../../code/model'
import type { Scope, Variable } from '../../../scope/model'
import { createWeakMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/weak-map'
import { createWeakSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/weak-set'

/** The hooks returning a value and a stable function as a pair. */
const PAIR_HOOKS = ['useState', 'useReducer', 'useActionState']

/**
 * Remembers which values are stable, and the state setters and state reads found on the way.
 *
 * @example Sort a component's values into stable and changing
 * ```ts
 * // function Counter() {
 * //   const [count, setCount] = useState(0)
 * //   const ref = useRef(null)
 * //   function reset() { setCount(0) }
 * //   function show() { log(count) }
 * // }
 * const stable = new StableValues()
 * stable.isStable(setCountVariable) // => true
 * stable.isStable(refVariable) // => true
 * stable.isStable(countVariable) // => false
 * stable.isCaptureFree(resetVariable, counterScope, new Set([counterScope])) // => true
 * stable.isCaptureFree(showVariable, counterScope, new Set([counterScope])) // => false
 * ```
 */
export class StableValues {
  /** The state setter references found, each with the state element it sets. */
  private readonly setters = createWeakMap<Node, Node>()

  /** The state value references found. */
  private readonly states = createWeakSet<Node>()

  /** The verdicts on hook values, by variable. */
  private readonly stable = createWeakMap<Variable, boolean>()

  /** The verdicts on capture-free functions, by variable. */
  private readonly captureFree = createWeakMap<Variable, boolean>()

  /**
   * Whether a reference is to a state setter, and so a call through it sets state.
   *
   * @param identifier - The identifier of a reference
   * @returns Whether it names a `useState` setter
   */
  isSetterCall(identifier: Node): boolean {
    return this.setters.has(identifier)
  }

  /**
   * The state element a setter reference sets.
   *
   * @param identifier - The identifier of a setter reference
   * @returns The state element of the pattern, or undefined for no setter
   */
  stateOf(identifier: Node): Node | undefined {
    return this.setters.get(identifier)
  }

  /**
   * Whether a reference reads a `useState` value.
   *
   * @param identifier - The identifier of a reference
   * @returns Whether it reads state
   */
  isStateRead(identifier: Node): boolean {
    return this.states.has(identifier)
  }

  /**
   * Whether a variable is a value a hook keeps stable, or a constant primitive.
   *
   * @param variable - The variable checked
   * @returns Whether its identity never changes between renders
   */
  isStable(variable: Variable): boolean {
    let verdict = this.stable.get(variable)
    if (verdict === undefined) {
      verdict = this.decide(variable)
      this.stable.set(variable, verdict)
    }
    return verdict
  }

  /**
   * Whether a variable is a function declared directly in the component that captures no
   * render-scope value other than stable ones.
   *
   * @param variable - The variable checked
   * @param component - The component's function scope
   * @param pure - The scopes whose values may change between renders
   * @returns Whether the function never needs to change
   */
  isCaptureFree(variable: Variable, component: Scope, pure: ReadonlySet<Scope>): boolean {
    let verdict = this.captureFree.get(variable)
    if (verdict === undefined) {
      verdict = this.decideCaptureFree(variable, component, pure)
      this.captureFree.set(variable, verdict)
    }
    return verdict
  }

  /**
   * Decides whether a variable is a stable hook value or a constant primitive.
   *
   * @param variable - The variable checked
   * @returns The verdict
   */
  private decide(variable: Variable): boolean {
    const declarator = variable.defs[0]?.node
    if (declarator?.kind !== 'VariableDeclarator') return false
    let init = declarator.init as Node | null
    if (init === null) return false
    while (init.kind === 'TSAsExpression') init = init.expression as Node
    const value = init.value
    const constant = (declarator.parent as Node).variableKind === 'const'
    const primitive = typeof value === 'string' || typeof value === 'number' || (value === null && init.regex === undefined)
    if (constant && init.kind === 'Literal' && primitive) return true
    if (init.kind !== 'CallExpression') return false
    let callee = init.callee as Node
    if (callee.kind === 'MemberExpression' && (callee.object as Node).name === 'React' && callee.computed !== true)
      callee = callee.property as Node
    if (callee.kind !== 'Identifier') return false
    const id = declarator.id as Node
    const name = callee.name as string
    if (name === 'useRef') return id.kind === 'Identifier'
    const elements = id.kind === 'ArrayPattern' ? (id.elements as readonly (Node | null)[]) : []
    if (elements.length !== 2) return false
    const declared = variable.identifiers[0]
    if (name === 'useTransition') return elements[1] === declared
    if (!PAIR_HOOKS.includes(name)) return false
    if (elements[1] === declared) return name !== 'useState' || this.recordSetter(variable, elements[0] as Node)
    if (elements[0] === declared && name === 'useState') for (const reference of variable.references) this.states.add(reference.identifier)
    return false
  }

  /**
   * Records a state setter's references, unless it is assigned again, which makes it unstable.
   *
   * @param variable - The setter variable whose references are recorded
   * @param state - The state element of its pattern
   * @returns Whether the setter is stable
   */
  private recordSetter(variable: Variable, state: Node): boolean {
    let writes = 0
    for (const reference of variable.references) {
      if (reference.isWrite()) writes += 1
      if (writes > 1) return false
      this.setters.set(reference.identifier, state)
    }
    return true
  }

  /**
   * Decides whether a variable is a capture-free function of the component.
   *
   * @param variable - The variable checked
   * @param component - The component's function scope
   * @param pure - The scopes whose values may change between renders
   * @returns The verdict
   */
  private decideCaptureFree(variable: Variable, component: Scope, pure: ReadonlySet<Scope>): boolean {
    const declared = variable.defs[0]?.node
    if (declared === undefined || declared.id === null || declared.id === undefined) return false
    const scope = component.children.find(
      (child) =>
        (declared.kind === 'FunctionDeclaration' && child.block === declared) ||
        (declared.kind === 'VariableDeclarator' && child.block.parent === declared)
    )
    if (scope === undefined) return false
    return scope.through.every((reference) => {
      const resolved = reference.resolved
      return resolved === null || !pure.has(resolved.scope) || this.isStable(resolved)
    })
  }
}
