/**
 * The scope analysis a rule asks for: built once per program and shared by every rule linting
 * it, with the queries rules make of it.
 *
 * @module scope/analysis
 */

import type { Node } from '../code/model'
import type { LanguageSettings } from '../config/model'
import type { RuleContext } from '../engine/rule'
import type { Scope, Variable } from './model'
import { createWeakMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/weak-map'
import { Binder } from './binder'

/** The scopes of one program. */
export interface ScopeAnalysis {
  /** The global scope. */
  readonly global: Scope
  /** Every scope, in the order opened. */
  readonly scopes: readonly Scope[]
  /** The scopes a node opened, in the order opened; none for most nodes. */
  readonly scopesOf: (block: Node) => readonly Scope[]
  /** The variables a node declares: a declaration's declarators, a function's name and parameters, an import's bindings. */
  readonly declaredVariables: (node: Node) => readonly Variable[]
}

/** The analyses built so far, by program. */
const analyses = createWeakMap<Node, ScopeAnalysis>()

/**
 * Analyses a program's scopes.
 *
 * @param program - The program's tree
 * @param language - How it is read
 * @returns The analysis
 *
 * @example Analyse a module with one function
 * ```ts
 * const text = 'let count = 0\nfunction bump(step) {\n  count += step\n}'
 * const program = parseCode(text, '.ts').tree
 * const analysis = analyzeScopes(program, DEFAULT_LANGUAGE)
 * analysis.scopes.map((scope) => scope.kind)
 * // => ['global', 'module', 'function']
 * analysis.declaredVariables(program.body[1]).map((variable) => variable.name)
 * // => ['bump', 'step']
 * ```
 */
export function analyzeScopes(program: Node, language: LanguageSettings): ScopeAnalysis {
  const binder = new Binder(language)
  binder.bindProgram(program)
  const { manager } = binder
  return {
    global: manager.global as Scope,
    scopes: manager.scopes,
    scopesOf: (block) => manager.nodeToScope.get(block) ?? [],
    declaredVariables: (node) => manager.declaredVariables.get(node) ?? [],
  }
}

/**
 * The scope analysis of the program a rule is linting, built on first request.
 *
 * @param context - The rule's context
 * @returns The analysis, the same object on every request for the program
 *
 * @example Share one analysis across a rule's handlers
 * ```ts
 * const analysis = scopeAnalysisOf(context)
 * scopeAnalysisOf(context) === analysis // => true, built once per program
 * ```
 */
export function scopeAnalysisOf(context: RuleContext<unknown, Node>): ScopeAnalysis {
  let analysis = analyses.get(context.tree)
  if (analysis === undefined) {
    analysis = analyzeScopes(context.tree, context.language)
    analyses.set(context.tree, analysis)
  }
  return analysis
}

/**
 * The innermost scope a node sits in: for the program itself the global scope, for any other
 * node the innermost scope its nearest scope-opening ancestor opened, which for a named
 * function expression is the function's scope rather than its name's.
 *
 * @param analysis - The program's analysis
 * @param node - The node whose scope is wanted
 * @returns The innermost scope enclosing the node
 *
 * @example Find the scope an identifier sits in
 * ```ts
 * // program: 'let count = 0\nfunction bump(step) {\n  count += step\n}'
 * // step: the Identifier read inside bump
 * scopeOf(analysis, step).kind // => 'function'
 * scopeOf(analysis, program).kind // => 'global'
 * ```
 */
export function scopeOf(analysis: ScopeAnalysis, node: Node): Scope {
  const inner = node.kind !== 'Program'
  for (let current: Node | null = node; current !== null; current = current.parent) {
    const scopes = analysis.scopesOf(current)
    if (scopes.length === 0) continue
    // why: a named function expression opens its name scope first and its function scope last, so the innermost is the function.
    return (inner ? scopes[scopes.length - 1] : scopes[0]) as Scope
  }
  return analysis.global
}

/**
 * The variable a name resolves to from a scope, looking outward.
 *
 * @param scope - The scope looked from
 * @param name - The name looked up
 * @returns The variable, or null when no scope in reach declares it
 *
 * @example Resolve a name outward from a function's scope
 * ```ts
 * const count = findVariable(scopeOf(analysis, step), 'count')
 * count.scope.kind // => 'module'
 * count.references.map((reference) => reference.direction)
 * // => ['write', 'read-write']
 * findVariable(scopeOf(analysis, step), 'missing') // => null
 * ```
 */
export function findVariable(scope: Scope, name: string): Variable | null {
  for (let current: Scope | null = scope; current !== null; current = current.upper) {
    const variable = current.set.get(name)
    if (variable !== undefined) return variable
  }
  return null
}
