/**
 * A `var` declaration is hoisted to its function and leaks out of the block it stands in;
 * `let` and `const` are scoped to their block. The fix turns `var` into `let` only where that
 * changes nothing: the variable is used inside its block alone, after its declaration, is
 * declared once, and does not become a global or a per-iteration binding that a closure sees.
 *
 * @module rules/javascript/no-var
 */

import type { Node, SourceToken } from '../../code/model'
import type { ScopeAnalysis } from '../../scope/analysis'
import type { Definition, Scope, Variable } from '../../scope/model'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { tokenText, tokensBetween } from '../../code/source'
import { defineRule } from '../../engine/rule'
import { scopeAnalysisOf } from '../../scope/analysis'

/** The kinds of node a `let` declaration would be scoped to. */
const SCOPE_NODES = createSet<string>(['Program', 'BlockStatement', 'SwitchStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement'])

/** The kinds of node whose statements may carry a `let` declaration. */
const STATEMENT_LISTS = createSet<string>(['Program', 'BlockStatement', 'StaticBlock', 'SwitchCase'])

/** The kinds of function node. */
const FUNCTIONS = createSet<string>(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])

/** The kinds of loop node. */
const LOOPS = createSet<string>(['ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement'])

export default defineRule<undefined, Node>({
  id: 'no-var',
  language: 'code',
  fixable: true,
  create(context) {
    return {
      'VariableDeclaration:exit'(node) {
        if (node.variableKind !== 'var') return
        const parent = node.parent as Node
        // why: a `declare global` block can only declare a global with `var`.
        if (parent.kind === 'TSModuleBlock' && (parent.parent as Node).global === true) return
        const keyword = tokensBetween(context.tree, node.start, node.end).find(
          (token) => tokenText(context.file, token) === 'var'
        ) as SourceToken
        context.report({
          start: node.start,
          end: node.end,
          message: 'Unexpected var, use let or const instead.',
          fix: canBecomeLet(scopeAnalysisOf(context), node) ? { start: keyword.start, end: keyword.end, text: 'let' } : undefined,
        })
      },
    }
  },
})

/**
 * Whether turning the declaration into a `let` changes nothing about the program.
 *
 * @param analysis - The program's scope analysis
 * @param node - The `var` declaration
 * @returns Whether to offer the fix
 */
function canBecomeLet(analysis: ScopeAnalysis, node: Node): boolean {
  const variables = analysis.declaredVariables(node)
  const parent = node.parent as Node
  const block = blockOf(node)
  const loopAssignee = (parent.kind === 'ForInStatement' || parent.kind === 'ForOfStatement') && parent.left === node
  if (parent.kind === 'SwitchCase') return false
  if (variables.some((variable) => variable.name === 'let' || variable.scope.kind === 'global' || variable.defs.length >= 2)) return false
  if (variables.some((variable) => isUsedOutside(variable, block))) return false
  if ((node.declarations as readonly Node[]).some((declarator) => hasReferenceBeforeInitialisation(analysis, declarator))) return false
  if (isInLoop(node)) {
    if (variables.some(isReferencedInClosure)) return false
    if (!loopAssignee && !(node.declarations as readonly Node[]).every((declarator) => declarator.init !== null)) return false
  }
  return loopAssignee || (parent.kind === 'ForStatement' && parent.init === node) || STATEMENT_LISTS.has(parent.kind)
}

/**
 * The node a `let` in the declaration's place would be scoped to.
 *
 * @param node - The declaration
 * @returns The nearest enclosing program, block, switch or `for` loop
 */
function blockOf(node: Node): Node {
  let current = node
  while (!SCOPE_NODES.has(current.kind)) current = current.parent as Node
  return current
}

/**
 * Whether a variable is referenced outside a node.
 *
 * @param variable - The variable tested
 * @param block - The node its `let` would be scoped to
 * @returns Whether a reference stands outside the node
 */
function isUsedOutside(variable: Variable, block: Node): boolean {
  return variable.references.some((ref) => ref.identifier.start < block.start || ref.identifier.end > block.end)
}

/**
 * Whether a declarator's variables are referenced where a `let` would be in its temporal dead
 * zone: before the declarator, in a default value of its pattern, or in its initialiser unless
 * the initialiser is a function, which runs later.
 *
 * @param analysis - The program's scope analysis
 * @param declarator - The declarator tested
 * @returns Whether a reference would fail under `let`
 */
function hasReferenceBeforeInitialisation(analysis: ScopeAnalysis, declarator: Node): boolean {
  const init = declarator.init as Node | null
  if (init === null) return false
  const insideInit = !FUNCTIONS.has(init.kind)
  return analysis.declaredVariables(declarator).some((variable) => {
    const id = (variable.defs[0] as Definition).name
    const pattern = id.parent as Node
    const fallback = pattern.kind === 'AssignmentPattern' ? (pattern.right as Node) : null
    return variable.references.some((ref) => {
      const { start, end } = ref.identifier
      if (ref.init) return false
      if (start < id.start) return true
      if (fallback !== null && start >= fallback.start && end <= fallback.end) return true
      return insideInit && start >= init.start && end <= init.end
    })
  })
}

/**
 * Whether a node stands in a loop of its own function.
 *
 * @param node - The node tested
 * @returns Whether a loop encloses it before any function does
 */
function isInLoop(node: Node): boolean {
  for (let current: Node | null = node; current !== null && !FUNCTIONS.has(current.kind); current = current.parent) {
    if (LOOPS.has(current.kind)) return true
  }
  return false
}

/**
 * Whether a variable is referenced from a function nested in the one declaring it.
 *
 * @param variable - The variable tested
 * @returns Whether a closure captures it
 */
function isReferencedInClosure(variable: Variable): boolean {
  const own = functionScopeOf(variable.scope)
  return variable.references.some((ref) => functionScopeOf(ref.from) !== own)
}

/**
 * The function scope enclosing a scope, or the global scope outside every function.
 *
 * @param scope - The scope looked out from
 * @returns The nearest function or global scope, the scope itself included
 */
function functionScopeOf(scope: Scope): Scope {
  let current = scope
  while (current.kind !== 'function' && current.kind !== 'global') current = current.upper as Scope
  return current
}
