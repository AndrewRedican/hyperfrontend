/**
 * The scope manager: opens and closes scopes as the binder walks the program, declares
 * variables, records references and resolves them when their scope closes, passing what a
 * scope cannot resolve up to the next.
 *
 * @module scope/manager
 */

import type { Node } from '../code/model'
import type { Definition, Direction, GlobalOptions, ReferenceKind, ScopeKind } from './model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { Reference, Scope, Variable } from './model'

/** The kinds of scope whose code is always strict. */
const STRICT_KINDS = createSet<ScopeKind>([
  'class',
  'conditionalType',
  'functionType',
  'mappedType',
  'module',
  'tsEnum',
  'tsModule',
  'type',
])

/**
 * The scopes of one program and the operations the binder performs on them.
 *
 * @example References resolve when their scope closes
 * ```ts
 * const manager = new ScopeManager(true)
 * manager.nest('global', program)
 * const module = manager.nest('module', program)
 * const total = manager.define(module, 'total', null, null)
 * const reference = manager.reference(identifier, 'read', 'value')
 * manager.close(program)
 * reference.resolved === total // => true
 * ```
 */
export class ScopeManager {
  /** Every scope, in the order opened. */
  readonly scopes: Scope[] = []
  /** The scopes each node opened, in the order opened. */
  readonly nodeToScope = createMap<Node, Scope[]>()
  /** The variables each declaring node declares. */
  readonly declaredVariables = createMap<Node, Variable[]>()
  /** Whether the program is an ES module. */
  readonly isModule: boolean
  /** The scope being bound, or null before the global scope opens and after it closes. */
  current: Scope | null = null
  /** The global scope, once opened. */
  global: Scope | null = null

  /**
   * Starts with no scope open.
   *
   * @param isModule - Whether the program is an ES module
   */
  constructor(isModule: boolean) {
    this.isModule = isModule
  }

  /**
   * The scope being bound.
   *
   * @returns The scope opened last and not yet closed
   */
  get scope(): Scope {
    return this.current as Scope
  }

  /**
   * Opens a scope nested in the current one.
   *
   * @param kind - Which construct opens it
   * @param block - The node opening it
   * @param isMethod - Whether it is the scope of a class method, which is always strict
   * @returns The scope, now current
   */
  nest(kind: ScopeKind, block: Node, isMethod = false): Scope {
    const scope = new Scope(kind, block, this.current, isStrictScope(kind, block, this.current, isMethod))
    this.scopes.push(scope)
    const opened = this.nodeToScope.get(block)
    if (opened === undefined) this.nodeToScope.set(block, [scope])
    else opened.push(scope)
    if (kind === 'global') this.global = scope
    // why: every function but an arrow has an arguments object.
    if (kind === 'function' && block.kind !== 'ArrowFunctionExpression') this.define(scope, 'arguments', null, null)
    this.current = scope
    return scope
  }

  /**
   * Closes every scope the node opened, innermost first, resolving their references.
   *
   * @param block - The node whose scopes close
   */
  close(block: Node): void {
    while (this.current !== null && this.current.block === block) {
      this.closeScope(this.current)
      this.current = this.current.upper
    }
  }

  /**
   * Declares a variable in a scope, or adds a declaration to one already declared.
   *
   * @param scope - The declaring scope
   * @param name - The name declared
   * @param identifier - The declaring identifier, or null when none names it
   * @param def - The declaration, or null for a name the scope knows without one
   * @param global - How a global is known, for the global scope's own names
   * @returns The variable
   */
  define(scope: Scope, name: string, identifier: Node | null, def: Definition | null, global: GlobalOptions | null = null): Variable {
    let variable = scope.set.get(name)
    if (variable === undefined) {
      variable = new Variable(name, scope, global)
      scope.set.set(name, variable)
      scope.variables.push(variable)
    }
    if (def !== null) {
      variable.defs.push(def)
      this.record(variable, def.node)
      this.record(variable, def.parent)
    }
    if (identifier !== null) variable.identifiers.push(identifier)
    return variable
  }

  /**
   * Records a reference made from the current scope.
   *
   * @param identifier - The identifier making it
   * @param direction - Whether it reads, writes, or both
   * @param kind - Whether it stands in a value position, a type position, or both
   * @param writeExpr - The expression assigned, for a write
   * @param init - Whether a write is the declaration's own initialisation
   * @returns The reference recorded
   */
  reference(identifier: Node, direction: Direction, kind: ReferenceKind, writeExpr: Node | null = null, init = false): Reference {
    const scope = this.scope
    const ref = new Reference(identifier, scope, direction, kind, writeExpr, init)
    scope.references.push(ref)
    scope.left?.push(ref)
    return ref
  }

  /**
   * Resolves what the global scope left unresolved against the names it knows, as the linter
   * does once the configured globals are declared, without regard to position.
   */
  finish(): void {
    const global = this.global as Scope
    const unresolved: Reference[] = []
    for (const ref of global.through) {
      const variable = global.set.get(ref.identifier.name as string)
      if (variable === undefined) unresolved.push(ref)
      else {
        ref.resolved = variable
        variable.references.push(ref)
      }
    }
    global.through.length = 0
    // why: a spread hands every element to one call, and a minified script leaves more references unresolved than a call accepts.
    for (const ref of unresolved) global.through.push(ref)
  }

  /**
   * Records that a node declares a variable.
   *
   * @param variable - The variable declared
   * @param node - The declaring node, or null
   */
  private record(variable: Variable, node: Node | null): void {
    if (node === null) return
    const variables = this.declaredVariables.get(node)
    if (variables === undefined) this.declaredVariables.set(node, [variable])
    else if (!variables.includes(variable)) variables.push(variable)
  }

  /**
   * Resolves a scope's pending references, passing up those it cannot resolve.
   *
   * @param scope - The scope closing
   */
  private closeScope(scope: Scope): void {
    for (const ref of scope.left as readonly Reference[]) {
      if (scope.kind === 'global' && !this.closesStatically(scope, ref)) scope.through.push(ref)
      else if (!resolve(scope, ref)) {
        scope.upper?.left?.push(ref)
        scope.through.push(ref)
      }
    }
    scope.left = null
  }

  /**
   * Whether the global scope resolves a reference itself: always in a module; in a script only
   * to a name every declaration of which the runtime would honour over a global of that name.
   *
   * @param global - The global scope closing
   * @param ref - The reference
   * @returns Whether to resolve statically
   */
  private closesStatically(global: Scope, ref: Reference): boolean {
    const variable = global.set.get(ref.identifier.name as string)
    if (variable === undefined) return false
    if (this.isModule) return true
    return variable.defs.length > 0 && variable.defs.every((def) => def.kind !== 'Variable' || def.parent?.variableKind !== 'var')
  }
}

/**
 * Resolves a reference against a scope's own variables.
 *
 * @param scope - The scope resolving
 * @param ref - The reference
 * @returns Whether it resolved
 */
function resolve(scope: Scope, ref: Reference): boolean {
  const variable = scope.set.get(ref.identifier.name as string)
  if (variable === undefined || !isValidResolution(scope, ref, variable)) return false
  // why: a type reference never resolves to a value-only variable, nor a value reference to a type-only one.
  if (!(ref.isTypeReference && variable.isType) && !(ref.isValueReference && variable.isValue)) return false
  variable.references.push(ref)
  ref.resolved = variable
  return true
}

/**
 * Whether a function scope may resolve a reference to a variable: a reference in the
 * parameters never reaches a variable the body declares.
 *
 * @param scope - The scope asked
 * @param ref - The reference
 * @param variable - The candidate
 * @returns Whether the resolution holds
 */
function isValidResolution(scope: Scope, ref: Reference, variable: Variable): boolean {
  if (scope.kind !== 'function' || scope.block.kind === 'Program') return true
  const body = scope.block.body as Node | undefined
  const bodyStart = body === undefined ? -1 : body.start
  return !(variable.scope === scope && ref.identifier.start < bodyStart && variable.defs.every((def) => def.name.start >= bodyStart))
}

/**
 * Whether a scope's code is strict: inherited from the enclosing scope, given by the kind, or
 * declared by a `use strict` directive opening a function or program body.
 *
 * @param kind - Which construct opens the scope
 * @param block - The node opening it
 * @param upper - The enclosing scope
 * @param isMethod - Whether it is a class method's scope
 * @returns Whether the code is strict
 */
function isStrictScope(kind: ScopeKind, block: Node, upper: Scope | null, isMethod: boolean): boolean {
  if (upper?.isStrict === true || isMethod || STRICT_KINDS.has(kind)) return true
  if (kind !== 'function' && kind !== 'global') return false
  const body = kind === 'global' || block.kind === 'Program' ? block : (block.body as Node | undefined)
  if (body === undefined || (body.kind !== 'BlockStatement' && body.kind !== 'Program')) return false
  for (const statement of body.body as readonly Node[]) {
    if (statement.kind !== 'ExpressionStatement') break
    if (statement.directive === 'use strict') return true
    const expression = statement.expression as Node
    if (expression.kind !== 'Literal') break
    if (expression.value === 'use strict') return true
  }
  return false
}
