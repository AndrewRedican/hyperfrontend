/**
 * A `let` that is assigned once and never again is a constant in all but name; `const` says so
 * and keeps it so. A destructuring is judged variable by variable, and a declaration becomes
 * `const` only when every variable it declares qualifies.
 *
 * @module rules/javascript/prefer-const
 */

import type { Node, SourceToken } from '../../code/model'
import type { Fix } from '../../engine/report'
import type { ScopeAnalysis } from '../../scope/analysis'
import type { Definition, Reference, Scope, Variable } from '../../scope/model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { tokenAfter } from '../../code/source'
import { defineRule } from '../../engine/rule'
import { findVariable, scopeAnalysisOf } from '../../scope/analysis'

/** The rule's options; the workspace runs the rule in its default mode, the only one implemented. */
export interface PreferConstOptions {
  /** How a destructuring is judged; only `any`, the default, is implemented: each variable on its own. */
  readonly destructuring?: 'any'
  /** Whether a variable read before its assignment is spared; only `false`, the default, is implemented. */
  readonly ignoreReadBeforeAssign?: false
}

/** The kinds of node a destructuring target sits in, between its identifier and the assignment. */
const PATTERNS = createSet<string>(['ObjectPattern', 'ArrayPattern', 'AssignmentPattern', 'RestElement', 'Property'])

/** The kinds of node whose statements may carry a declaration in an assignment's place. */
const DECLARATION_HOSTS = createSet<string>(['Program', 'BlockStatement', 'StaticBlock', 'SwitchCase'])

export default defineRule<PreferConstOptions | undefined, Node>({
  id: 'prefer-const',
  language: 'code',
  fixable: true,
  create(context) {
    const declarations: Node[] = []
    return {
      VariableDeclaration(node) {
        const parent = node.parent as Node
        // why: the counter of a `for` loop is updated by the loop; it is never a constant.
        if (node.variableKind === 'let' && !(parent.kind === 'ForStatement' && parent.init === node)) declarations.push(node)
      },
      'Program:exit'() {
        const analysis = scopeAnalysisOf(context)
        const constants = createMap<Variable, Node | null>()
        const groups = createMap<Node, (Node | null)[]>()
        for (const declaration of declarations) {
          for (const variable of analysis.declaredVariables(declaration)) {
            const identifier = constantIdentifierOf(analysis, variable)
            constants.set(variable, identifier)
            let previous: Node | null = null
            for (const ref of variable.references) {
              // why: a destructuring default writes the same identifier twice; it joins its group once.
              if (ref.identifier === previous) continue
              previous = ref.identifier
              const host = destructuringHostOf(ref)
              if (host === null) continue
              const group = groups.get(host)
              if (group === undefined) groups.set(host, [identifier])
              else group.push(identifier)
            }
          }
        }
        for (const [, nodes] of groups) {
          const identifiers = nodes.filter((node): node is Node => node !== null)
          if (identifiers.length === 0) continue
          const declaration = declarationOf(identifiers[0] as Node)
          const fix =
            declaration !== null && identifiers.length === nodes.length && canBecomeConst(analysis, declaration, constants)
              ? constFix(context.file.text, context.tree, declaration)
              : undefined
          for (const identifier of identifiers) {
            context.report({
              start: identifier.start,
              end: identifier.end,
              message: `'${identifier.name as string}' is never reassigned. Use 'const' instead.`,
              fix,
            })
          }
        }
      },
    }
  },
})

/**
 * The identifier to report when a variable should be a constant: the identifier of its one
 * write, or the declared one when the variable is read before that write.
 *
 * @param analysis - The program's scope analysis
 * @param variable - The variable judged
 * @returns The identifier, or null when the variable is written more than once, from another
 * scope, or where no declaration could stand
 */
function constantIdentifierOf(analysis: ScopeAnalysis, variable: Variable): Node | null {
  let writer: Reference | null = null
  let readBeforeWrite = false
  for (const ref of variable.references) {
    if (!ref.isWrite()) {
      if (writer === null) readBeforeWrite = true
      continue
    }
    if (writer !== null && writer.identifier !== ref.identifier) return null
    const host = destructuringHostOf(ref)
    if (host !== null && host.kind === 'AssignmentExpression' && isMixedTarget(analysis, host.left as Node, variable.scope)) return null
    writer = ref
  }
  if (writer === null || writer.from !== variable.scope || !canBecomeDeclaration(writer.identifier)) return null
  return readBeforeWrite ? (variable.defs[0] as Definition).name : writer.identifier
}

/**
 * The declarator or assignment a written identifier belongs to, through any destructuring
 * pattern around it.
 *
 * @param ref - The reference
 * @returns The host, or null for a read or a write that is neither
 */
function destructuringHostOf(ref: Reference): Node | null {
  if (!ref.isWrite()) return null
  let node = ref.identifier.parent as Node
  while (PATTERNS.has(node.kind)) node = node.parent as Node
  return node.kind === 'VariableDeclarator' || node.kind === 'AssignmentExpression' ? node : null
}

/**
 * Whether a written identifier could be declared where it is written: in a declarator, or in an
 * assignment that is a statement of its own in a place a declaration may stand.
 *
 * @param identifier - The written identifier
 * @returns Whether a declaration could take the write's place
 */
function canBecomeDeclaration(identifier: Node): boolean {
  let node = identifier.parent as Node
  while (PATTERNS.has(node.kind)) node = node.parent as Node
  if (node.kind === 'VariableDeclarator') return true
  const statement = node.parent as Node
  return (
    node.kind === 'AssignmentExpression' &&
    statement.kind === 'ExpressionStatement' &&
    DECLARATION_HOSTS.has((statement.parent as Node).kind)
  )
}

/**
 * Whether a destructuring assignment also targets a variable of an outer scope, or a member of
 * an object, which no declaration could take in.
 *
 * @param analysis - The program's scope analysis
 * @param target - The pattern assigned to
 * @param scope - The scope of the variable judged
 * @returns Whether the pattern mixes in such targets
 */
function isMixedTarget(analysis: ScopeAnalysis, target: Node, scope: Scope): boolean {
  let names: Node[] = []
  if (target.kind === 'ObjectPattern') {
    names = (target.properties as readonly Node[]).map((property) => property.value).filter((value): value is Node => value !== undefined)
  } else if (target.kind === 'ArrayPattern') {
    names = (target.elements as readonly (Node | null)[]).filter((element): element is Node => element !== null)
  }
  const outer = names.some((name) => name.kind === 'Identifier' && isOuterVariable(name.name as string, scope))
  return outer || hasMemberTarget(target)
}

/**
 * Whether a name is a variable of a scope outside the one given: one a reference passes
 * through the scope to reach, or a parameter.
 *
 * @param name - The name tested
 * @param scope - The scope looked out from
 * @returns Whether the name belongs to an outer scope
 */
function isOuterVariable(name: string, scope: Scope): boolean {
  if (scope.through.some((ref) => ref.resolved !== null && ref.resolved.name === name)) return true
  const variable = findVariable(scope, name)
  return variable !== null && variable.defs.some((def) => def.kind === 'Parameter')
}

/**
 * Whether a pattern assigns to a member of an object anywhere in it.
 *
 * @param node - The pattern, or a target in it
 * @returns Whether a member expression is among the targets
 */
function hasMemberTarget(node: Node): boolean {
  switch (node.kind) {
    case 'ObjectPattern':
      return (node.properties as readonly Node[]).some((property) =>
        hasMemberTarget(property.kind === 'RestElement' ? (property.argument as Node) : (property.value as Node))
      )
    case 'ArrayPattern':
      return (node.elements as readonly (Node | null)[]).some((element) => element !== null && hasMemberTarget(element))
    case 'AssignmentPattern':
      return hasMemberTarget(node.left as Node)
    case 'MemberExpression':
      return true
    default:
      return false
  }
}

/**
 * The declaration a reported identifier belongs to, when it is declared where it is written.
 *
 * @param identifier - The reported identifier
 * @returns The declaration, or null for an identifier written by an assignment
 */
function declarationOf(identifier: Node): Node | null {
  for (let current: Node | null = identifier; current !== null && !current.kind.endsWith('Statement'); current = current.parent) {
    if (current.kind === 'VariableDeclaration') return current
  }
  return null
}

/**
 * Whether a whole declaration can become `const`: it heads a `for-in` or `for-of` loop or
 * initialises every declarator, and every variable it declares is a constant.
 *
 * @param analysis - The program's scope analysis
 * @param declaration - The `let` declaration judged
 * @param constants - The identifier each variable is reported at, or null for one that is no constant
 * @returns Whether to offer the fix
 */
function canBecomeConst(analysis: ScopeAnalysis, declaration: Node, constants: ReadonlyMap<Variable, Node | null>): boolean {
  const parent = declaration.parent as Node
  const initialised =
    parent.kind === 'ForInStatement' ||
    parent.kind === 'ForOfStatement' ||
    (declaration.declarations as readonly Node[]).every((declarator) => declarator.init !== null)
  return initialised && analysis.declaredVariables(declaration).every((variable) => constants.get(variable) !== null)
}

/**
 * The fix that turns a declaration's `let` into `const`, over the whole declaration so that no
 * other fix lands in it in the same pass.
 *
 * @param text - The file's text
 * @param program - The program, for its tokens
 * @param declaration - The `let` declaration rewritten
 * @returns The replacement
 */
function constFix(text: string, program: Node, declaration: Node): Fix {
  const keyword = tokenAfter(program, declaration.start) as SourceToken
  return { start: declaration.start, end: declaration.end, text: `const${text.slice(keyword.end, declaration.end)}` }
}
