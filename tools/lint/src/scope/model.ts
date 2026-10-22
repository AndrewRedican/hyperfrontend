/**
 * The scope model: the scopes a program nests, the variables each declares, the references
 * each identifier makes and how those resolve. It holds what rules ask of a scope analysis: a
 * variable's definitions and references, a reference's direction and kind, the scope a node
 * sits in.
 *
 * @module scope/model
 */

import type { Node } from '../code/model.ts'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** Which construct opened a scope. */
export type ScopeKind =
  | 'block'
  | 'catch'
  | 'class'
  | 'class-field-initializer'
  | 'class-static-block'
  | 'conditionalType'
  | 'for'
  | 'function'
  | 'function-expression-name'
  | 'functionType'
  | 'global'
  | 'mappedType'
  | 'module'
  | 'switch'
  | 'tsEnum'
  | 'tsModule'
  | 'type'

/** What declared a variable. */
export type DefinitionKind =
  | 'CatchClause'
  | 'ClassName'
  | 'FunctionName'
  | 'ImportBinding'
  | 'Parameter'
  | 'TSEnumName'
  | 'TSEnumMemberName'
  | 'TSModuleName'
  | 'Type'
  | 'Variable'

/** One declaration of a variable. */
export interface Definition {
  /** What declared it. */
  readonly kind: DefinitionKind
  /** The identifier declared, or the string literal naming an enum member. */
  readonly name: Node
  /** The declaring node: the declarator, the function or class, the import specifier, the enum member, the module, the type. */
  readonly node: Node
  /** The statement the declaring node belongs to, when one exists: the variable or import declaration. */
  readonly parent: Node | null
  /** Whether a parameter is the rest parameter. */
  readonly rest: boolean
  /** Whether the declaration is valid in a type position. */
  readonly isType: boolean
  /** Whether the declaration is valid in a value position. */
  readonly isValue: boolean
}

/** Whether a reference reads, writes, or both. */
export type Direction = 'read' | 'write' | 'read-write'

/** Whether a reference stands in a value position, a type position, or one that is both. */
export type ReferenceKind = 'value' | 'type' | 'both'

/** How a global the language or the configuration declares is known. */
export interface GlobalOptions {
  /** The positions the name is valid in, or null when they follow what a script declares. */
  readonly kind: ReferenceKind | null
  /** Whether the name may be assigned. */
  readonly writable: boolean
}

/** The kinds of scope a `var` declaration lands in. */
const VARIABLE_SCOPES = createSet<ScopeKind>(['class-field-initializer', 'class-static-block', 'function', 'global', 'module', 'tsModule'])

/** A name declared in a scope, or known to the global scope. */
export class Variable {
  /** The name as declared. */
  readonly name: string
  /** The scope that declares it. */
  readonly scope: Scope
  /** The identifiers that declare it, in source order. */
  readonly identifiers: Node[] = []
  /** Its declarations. */
  readonly defs: Definition[] = []
  /** The references that resolved to it, in resolution order. */
  readonly references: Reference[] = []
  /** For a global: whether it may be assigned; null for a declared variable. */
  writable: boolean | null
  /** For a global: the positions it is valid in; null for a declared variable. */
  readonly globalKind: ReferenceKind | null
  /** Whether a rule marked it used. */
  used = false

  /**
   * Declares a name in a scope.
   *
   * @param name - The name declared
   * @param scope - The declaring scope
   * @param global - How the name is known when the language or the configuration declares it; null for a declared variable
   */
  constructor(name: string, scope: Scope, global: GlobalOptions | null) {
    this.name = name
    this.scope = scope
    this.writable = global === null ? null : global.writable
    this.globalKind = global === null ? null : global.kind
  }

  /**
   * Whether the variable is valid in a type position; a global with fixed positions keeps them whatever a script declares.
   *
   * @returns Whether a type reference may resolve to it
   */
  get isType(): boolean {
    if (this.globalKind !== null) return this.globalKind !== 'value'
    return this.defs.length === 0 || this.defs.some((def) => def.isType)
  }

  /**
   * Whether the variable is valid in a value position; a global with fixed positions keeps them whatever a script declares.
   *
   * @returns Whether a value reference may resolve to it
   */
  get isValue(): boolean {
    if (this.globalKind !== null) return this.globalKind !== 'type'
    return this.defs.length === 0 || this.defs.some((def) => def.isValue)
  }
}

/** One use of a name. */
export class Reference {
  /** The identifier, or JSX identifier, making the reference; a declaration's own identifier for a JSX pragma reference. */
  readonly identifier: Node
  /** The scope the reference was made from. */
  readonly from: Scope
  /** The variable it resolved to, or null. */
  resolved: Variable | null = null
  /** Whether it reads, writes, or both. */
  readonly direction: Direction
  /** Whether it stands in a value position, a type position, or both. */
  readonly kind: ReferenceKind
  /** For a write: the expression assigned, when one exists. */
  readonly writeExpr: Node | null
  /** For a write: whether it is the declaration's own initialisation. */
  readonly init: boolean

  /**
   * Records one use of a name.
   *
   * @param identifier - The identifier making the reference
   * @param from - The scope it was made from
   * @param direction - Whether it reads, writes, or both
   * @param kind - Whether it stands in a value position, a type position, or both
   * @param writeExpr - The expression assigned, for a write
   * @param init - Whether a write is the declaration's own initialisation
   */
  constructor(identifier: Node, from: Scope, direction: Direction, kind: ReferenceKind, writeExpr: Node | null, init: boolean) {
    this.identifier = identifier
    this.from = from
    this.direction = direction
    this.kind = kind
    this.writeExpr = direction === 'read' ? null : writeExpr
    this.init = direction === 'read' ? false : init
  }

  /**
   * Whether the reference writes.
   *
   * @returns True for a write or a read-write
   */
  isWrite(): boolean {
    return this.direction !== 'read'
  }

  /**
   * Whether the reference reads.
   *
   * @returns True for a read or a read-write
   */
  isRead(): boolean {
    return this.direction !== 'write'
  }

  /**
   * Whether the reference stands in a type position.
   *
   * @returns True for a type reference or one in both positions
   */
  get isTypeReference(): boolean {
    return this.kind !== 'value'
  }

  /**
   * Whether the reference stands in a value position.
   *
   * @returns True for a value reference or one in both positions
   */
  get isValueReference(): boolean {
    return this.kind !== 'type'
  }
}

/** One scope. */
export class Scope {
  /** Which construct opened it. */
  readonly kind: ScopeKind
  /** The node that opened it. */
  readonly block: Node
  /** The enclosing scope, or null for the global scope. */
  readonly upper: Scope | null
  /** The scopes nested in it, in source order. */
  readonly children: Scope[] = []
  /** The variables it declares, in declaration order. */
  readonly variables: Variable[] = []
  /** Its variables by name. */
  readonly set = createMap<string, Variable>()
  /** The references made from it, in source order. */
  readonly references: Reference[] = []
  /** The references that passed through it unresolved. */
  readonly through: Reference[] = []
  /** The nearest scope, this one included, that a `var` declaration lands in. */
  readonly variableScope: Scope
  /** Whether its code is strict. */
  isStrict: boolean
  /** The references made in it or passed up to it, still to resolve; null once closed. */
  left: Reference[] | null = []

  /**
   * Opens a scope under another.
   *
   * @param kind - Which construct opened it
   * @param block - The node that opened it
   * @param upper - The enclosing scope
   * @param isStrict - Whether its code is strict
   */
  constructor(kind: ScopeKind, block: Node, upper: Scope | null, isStrict: boolean) {
    this.kind = kind
    this.block = block
    this.upper = upper
    this.isStrict = isStrict
    this.variableScope = upper === null || VARIABLE_SCOPES.has(kind) ? this : upper.variableScope
    upper?.children.push(this)
  }
}
