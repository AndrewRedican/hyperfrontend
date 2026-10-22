/**
 * The binder: walks a program, opening the scopes its constructs nest, declaring the variables
 * each introduces and recording every identifier reference as a read, a write or both, in a
 * value or a type position, in the scope it was made from. Resolution happens as scopes close.
 *
 * @module scope/binder
 */

import type { Node } from '../code/model.ts'
import type { LanguageSettings } from '../config/model.ts'
import type { Definition, DefinitionKind, Direction, Scope } from './model.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { CHILD_FIELDS, childrenOf } from '../code/children.ts'
import { bindDeclaration } from './bind-declarations.ts'
import { visitTypeNode } from './bind-types.ts'
import { LANGUAGE_GLOBALS } from './globals.ts'
import { ScopeManager } from './manager.ts'

/** What a pattern visit knows about one bound identifier. */
export interface PatternInfo {
  /** The assignment expressions and patterns enclosing the identifier, outermost first. */
  readonly assignments: readonly Node[]
  /** Whether the identifier is a rest element's target. */
  readonly rest: boolean
}

/** The action taken for each identifier a pattern binds. */
export type PatternCallback = (pattern: Node, info: PatternInfo) => void

/** The names a CommonJS loader gives a module, `exports` alone writable. */
const COMMONJS_GLOBALS = ['exports', 'global', 'module', 'require']

/** The node kinds that bind names when they stand on the left of an assignment. */
const PATTERNS = createSet<string>(['ArrayPattern', 'AssignmentPattern', 'Identifier', 'ObjectPattern', 'RestElement'])

/** The node kinds the declaration binder handles. */
const DECLARATIONS = createSet<string>([
  'ArrowFunctionExpression',
  'FunctionDeclaration',
  'FunctionExpression',
  'TSDeclareFunction',
  'TSEmptyBodyFunctionExpression',
  'ClassDeclaration',
  'ClassExpression',
  'ImportDeclaration',
  'ExportDefaultDeclaration',
  'ExportNamedDeclaration',
  'TSExportAssignment',
  'TSImportEqualsDeclaration',
  'TSEnumDeclaration',
  'TSModuleDeclaration',
  'JSXAttribute',
  'JSXClosingElement',
  'JSXFragment',
  'JSXIdentifier',
  'JSXMemberExpression',
  'JSXOpeningElement',
])

/**
 * Whether a node binds names on the left of an assignment.
 *
 * @param node - The node tested
 * @returns Whether it is a pattern
 */
export function isPattern(node: Node): boolean {
  return PATTERNS.has(node.kind)
}

/** The walk over one program. */
export class Binder {
  /** The scopes being built. */
  readonly manager: ScopeManager
  /** How the program is read. */
  readonly language: LanguageSettings
  /** Whether the JSX pragma has been referenced, which happens once. */
  referencedPragma = false
  /** Whether the JSX fragment factory has been referenced, which happens once. */
  referencedFragment = false

  /**
   * Starts the walk of one program.
   *
   * @param language - How the program is read
   */
  constructor(language: LanguageSettings) {
    this.manager = new ScopeManager(language.sourceType === 'module')
    this.language = language
  }

  /**
   * The scope being bound.
   *
   * @returns The scope opened last and not yet closed
   */
  get scope(): Scope {
    return this.manager.scope
  }

  /**
   * Binds a whole program.
   *
   * @param program - The program's tree
   */
  bindProgram(program: Node): void {
    const global = this.manager.nest('global', program)
    for (const name in LANGUAGE_GLOBALS)
      this.manager.define(global, name, null, null, { kind: LANGUAGE_GLOBALS[name] ?? null, writable: false })
    this.manager.define(global, 'const', null, null, { kind: 'type', writable: false })
    for (const name in this.language.globals) {
      const variable = this.manager.define(global, name, null, null, { kind: null, writable: false })
      variable.writable = this.language.globals[name] === 'writable'
    }
    if (this.language.sourceType === 'commonjs') {
      // why: a CommonJS module sees its loader's names, and is sloppy at the top level; the function scope wrapping it decides strictness.
      for (const name of COMMONJS_GLOBALS) this.manager.define(global, name, null, null, { kind: null, writable: name === 'exports' })
      global.isStrict = false
      this.manager.nest('function', program)
    }
    if (this.language.sourceType === 'module') this.manager.nest('module', program)
    this.visitChildren(program)
    this.manager.close(program)
    this.manager.finish()
  }

  /**
   * Visits a node in a value position.
   *
   * @param node - The node, or nothing
   */
  visit(node: Node | null | undefined): void {
    if (node === null || node === undefined) return
    if (DECLARATIONS.has(node.kind)) {
      bindDeclaration(this, node)
      return
    }
    switch (node.kind) {
      case 'AssignmentExpression':
        this.visitAssignment(node)
        break
      case 'BlockStatement':
        this.manager.nest('block', node)
        this.visitChildren(node)
        this.manager.close(node)
        break
      case 'BreakStatement':
      case 'ContinueStatement':
      case 'ExportAllDeclaration':
      case 'ImportAttribute':
      case 'MetaProperty':
      case 'PrivateIdentifier':
        break
      case 'CallExpression':
      case 'NewExpression':
      case 'TSInstantiationExpression':
        this.visitChildren(node, ['typeArguments'])
        this.visitType(node.typeArguments)
        break
      case 'CatchClause':
        this.visitCatch(node)
        break
      case 'ForInStatement':
      case 'ForOfStatement':
        this.visitForIn(node)
        break
      case 'ForStatement':
        if (node.init?.kind === 'VariableDeclaration' && node.init.variableKind !== 'var') this.manager.nest('for', node)
        this.visitChildren(node)
        this.manager.close(node)
        break
      case 'Identifier':
        this.manager.reference(node, 'read', 'value')
        this.visitType(node.typeAnnotation)
        break
      case 'LabeledStatement':
        this.visit(node.body as Node)
        break
      case 'MemberExpression':
        this.visit(node.object)
        if (node.computed === true) this.visit(node.property)
        break
      case 'Property':
        if (node.computed === true) this.visit(node.key)
        this.visit(node.value as Node)
        break
      case 'SwitchStatement':
        this.visit(node.discriminant)
        this.manager.nest('switch', node)
        for (const switchCase of node.cases as readonly Node[]) this.visit(switchCase)
        this.manager.close(node)
        break
      case 'TaggedTemplateExpression':
        this.visit(node.tag)
        this.visit(node.quasi)
        this.visitType(node.typeArguments)
        break
      case 'TSAsExpression':
      case 'TSSatisfiesExpression':
      case 'TSTypeAssertion':
        this.visit(node.expression as Node)
        this.visitType(node.typeAnnotation)
        break
      case 'TSInterfaceDeclaration':
      case 'TSTypeAliasDeclaration':
        this.visitType(node)
        break
      case 'UpdateExpression':
        this.visitUpdate(node)
        break
      case 'VariableDeclaration':
        this.visitVariableDeclaration(node)
        break
      default:
        this.visitChildren(node)
    }
  }

  /**
   * Visits a node's children in value positions.
   *
   * @param node - The node whose children are visited
   * @param exclude - Fields to leave out
   */
  visitChildren(node: Node, exclude: readonly string[] = []): void {
    for (const field of CHILD_FIELDS[node.kind]) {
      if (exclude.includes(field)) continue
      const value = node[field] as Node | readonly (Node | null)[] | null | undefined
      if (value === null || value === undefined) continue
      if ('kind' in value) this.visit(value)
      else for (const child of value) this.visit(child)
    }
  }

  /**
   * Visits a node in a type position.
   *
   * @param node - The node, or nothing
   */
  visitType(node: Node | null | undefined): void {
    if (node !== null && node !== undefined) visitTypeNode(this, node)
  }

  /**
   * Walks a pattern, calling back for each identifier it binds, and visits the expressions it
   * holds as values when asked.
   *
   * @param root - The pattern walked
   * @param callback - The action taken for each bound identifier
   * @param processRightHandNodes - Whether to visit the defaults, computed keys and call arguments inside it
   */
  visitPattern(root: Node, callback: PatternCallback, processRightHandNodes = false): void {
    const rightHand: Node[] = []
    const assignments: Node[] = []
    const rests: Node[] = []
    const walk = (node: Node | null): void => {
      // why: an array pattern's holes are null elements.
      if (node === null) return
      switch (node.kind) {
        case 'ArrayPattern':
          for (const element of node.elements as readonly (Node | null)[]) walk(element)
          break
        case 'AssignmentPattern':
          assignments.push(node)
          walk(node.left as Node)
          rightHand.push(node.right as Node)
          assignments.pop()
          break
        case 'Decorator':
        case 'TSTypeAnnotation':
          break
        case 'Identifier':
          callback(node, { assignments, rest: rests[rests.length - 1]?.argument === node })
          break
        case 'MemberExpression':
          if (node.computed === true) rightHand.push(node.property as Node)
          rightHand.push(node.object as Node)
          break
        case 'Property':
          if (node.computed === true) rightHand.push(node.key as Node)
          walk(node.value as Node)
          break
        case 'RestElement':
          rests.push(node)
          walk(node.argument as Node)
          rests.pop()
          break
        default:
          for (const child of childrenOf(node)) walk(child)
      }
    }
    walk(root)
    if (processRightHandNodes) for (const node of rightHand) this.visit(node)
  }

  /**
   * Declares an identifier in a scope.
   *
   * @param scope - The declaring scope
   * @param identifier - The identifier declared
   * @param kind - What declares it
   * @param node - The declaring node
   * @param parent - The statement the node belongs to, or null
   * @param rest - Whether a parameter is the rest parameter
   */
  define(scope: Scope, identifier: Node, kind: DefinitionKind, node: Node, parent: Node | null = null, rest = false): void {
    this.manager.define(scope, identifier.name as string, identifier, definition(kind, identifier, node, parent, rest))
  }

  /**
   * Records the writes the defaults enclosing a bound identifier make to it.
   *
   * @param pattern - The identifier written to
   * @param assignments - The assignment expressions and patterns enclosing it
   * @param init - Whether the writes initialise a declaration
   */
  referenceDefaults(pattern: Node, assignments: readonly Node[], init: boolean): void {
    for (const assignment of assignments) this.manager.reference(pattern, 'write', 'value', assignment.right as Node, init)
  }

  /**
   * References the JSX pragma once, as a read of its declaration from the current scope.
   */
  referencePragma(): void {
    if (this.language.jsxPragma === null || this.referencedPragma) return
    this.referencedPragma = this.referenceInSomeUpperScope(this.language.jsxPragma)
  }

  /**
   * References the JSX fragment factory once, as a read of its declaration from the current scope.
   */
  referenceFragment(): void {
    if (this.language.jsxFragmentName === null || this.referencedFragment) return
    this.referencedFragment = this.referenceInSomeUpperScope(this.language.jsxFragmentName)
  }

  /**
   * References a name's declaration from the scope that declares it, when one is in reach.
   *
   * @param name - The name looked up
   * @returns Whether a declaration was found
   */
  private referenceInSomeUpperScope(name: string): boolean {
    for (let scope: Scope | null = this.scope; scope !== null; scope = scope.upper) {
      const variable = scope.set.get(name)
      if (variable === undefined) continue
      const ref = this.manager.reference(variable.identifiers[0] as Node, 'read', 'value')
      // why: the reference is made from the declaring scope, whichever scope the element sits in.
      if (scope !== this.scope) {
        this.scope.references.pop()
        this.scope.left?.pop()
        scope.references.push(ref)
        scope.left?.push(ref)
      }
      return true
    }
    return false
  }

  /**
   * The expression an assignment or update targets once type assertions and non-null
   * assertions are unwrapped, their types visited.
   *
   * @param left - The target as written
   * @returns The expression the assignment or update reaches
   */
  private expressionTarget(left: Node): Node {
    if (left.kind === 'TSAsExpression' || left.kind === 'TSTypeAssertion') {
      this.visitType(left.typeAnnotation)
      return left.expression as Node
    }
    return left.kind === 'TSNonNullExpression' ? (left.expression as Node) : left
  }

  /**
   * Binds an assignment: writes to the pattern on the left, reads of the right.
   *
   * @param node - The assignment expression
   */
  private visitAssignment(node: Node): void {
    const left = this.expressionTarget(node.left as Node)
    if (isPattern(left)) {
      if (node.operator === '=') {
        this.visitPattern(
          left,
          (pattern, info) => {
            this.referenceDefaults(pattern, info.assignments, false)
            this.manager.reference(pattern, 'write', 'value', node.right as Node, false)
          },
          true
        )
      } else if (left.kind === 'Identifier') this.manager.reference(left, 'read-write', 'value', node.right as Node, false)
    } else this.visit(left)
    this.visit(node.right)
  }

  /**
   * Binds an increment or decrement: a read and write of its target.
   *
   * @param node - The update expression
   */
  private visitUpdate(node: Node): void {
    const argument = this.expressionTarget(node.argument as Node)
    if (isPattern(argument)) this.visitPattern(argument, (pattern) => this.manager.reference(pattern, 'read-write', 'value'))
    else this.visitChildren(node)
  }

  /**
   * Binds a catch clause: its own scope, its parameter, its body.
   *
   * @param node - The clause
   */
  private visitCatch(node: Node): void {
    this.manager.nest('catch', node)
    const param = node.param
    if (param !== null && param !== undefined) {
      this.visitPattern(
        param,
        (pattern, info) => {
          this.manager.define(this.scope, pattern.name as string, pattern, definition('CatchClause', param, node, null, false))
          this.referenceDefaults(pattern, info.assignments, true)
        },
        true
      )
    }
    this.visit(node.body as Node)
    this.manager.close(node)
  }

  /**
   * Binds a for-in or for-of loop: a scope of its own for a `let` or `const` head, writes to
   * the head's pattern from the iterated expression.
   *
   * @param node - The loop
   */
  private visitForIn(node: Node): void {
    const left = node.left as Node
    if (left.kind === 'VariableDeclaration' && left.variableKind !== 'var') this.manager.nest('for', node)
    if (left.kind === 'VariableDeclaration') {
      this.visit(left)
      this.visitPattern((left.declarations as readonly Node[])[0]?.id as Node, (pattern) => {
        this.manager.reference(pattern, 'write', 'value', node.right as Node, true)
      })
    } else {
      this.visitPattern(
        left,
        (pattern, info) => {
          this.referenceDefaults(pattern, info.assignments, false)
          this.manager.reference(pattern, 'write', 'value', node.right as Node, false)
        },
        true
      )
    }
    this.visit(node.right)
    this.visit(node.body as Node)
    this.manager.close(node)
  }

  /**
   * Binds a variable declaration: its names in the block or the variable scope, writes from
   * their initialisers, their types.
   *
   * @param node - The declaration bound
   */
  private visitVariableDeclaration(node: Node): void {
    const target = node.variableKind === 'var' ? this.scope.variableScope : this.scope
    for (const declarator of node.declarations as readonly Node[]) {
      const init = declarator.init as Node | null
      this.visitPattern(
        declarator.id as Node,
        (pattern, info) => {
          this.manager.define(target, pattern.name as string, pattern, definition('Variable', pattern, declarator, node, false))
          this.referenceDefaults(pattern, info.assignments, true)
          if (init !== null) this.manager.reference(pattern, 'write', 'value', init, true)
        },
        true
      )
      this.visit(init)
      this.visitType((declarator.id as Node).typeAnnotation)
    }
  }
}

/** The kinds of declaration valid in a type position. */
const TYPE_KINDS = createSet<DefinitionKind>(['ClassName', 'ImportBinding', 'TSEnumMemberName', 'TSEnumName', 'TSModuleName', 'Type'])

/**
 * A declaration record.
 *
 * @param kind - What declares the name
 * @param name - The declaring identifier or literal
 * @param node - The declaring node
 * @param parent - The statement the node belongs to, or null
 * @param rest - Whether a parameter is the rest parameter
 * @returns The record
 */
export function definition(kind: DefinitionKind, name: Node, node: Node, parent: Node | null, rest: boolean): Definition {
  return { kind, name, node, parent, rest, isType: TYPE_KINDS.has(kind), isValue: kind !== 'Type' }
}

/**
 * A read reference in a value position, as the binder makes for a bare identifier.
 *
 * @param binder - The walk in progress
 * @param identifier - The identifier referenced
 * @param direction - Whether it reads, writes, or both
 */
export function referenceValue(binder: Binder, identifier: Node, direction: Direction = 'read'): void {
  binder.manager.reference(identifier, direction, 'value')
}
