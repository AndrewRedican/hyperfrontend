/**
 * The regular expressions a file builds by calling `RegExp`: whether a callee is the language's
 * `RegExp`, named outright, reached through the global object or held in a constant, and what
 * string an argument is known to hold without running the code.
 *
 * @module rules/javascript/shared/regexp-construction
 */

import type { Node, TemplateValue } from '../../../code/model.ts'
import type { ScopeAnalysis } from '../../../scope/analysis.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { isGlobalReference, referenceOf } from './constant.ts'

/** The names the global object goes by. */
const GLOBAL_OBJECTS = createSet(['globalThis', 'window', 'self', 'global'])

/**
 * The string a literal holds.
 *
 * @param node - A node, or undefined for an argument not given
 * @returns The string, or null when the node is no string literal
 */
export function stringLiteralValue(node: Node | undefined): string | null {
  return node !== undefined && node.kind === 'Literal' && typeof node.value === 'string' ? node.value : null
}

/**
 * Whether a call's callee is the language's `RegExp` named outright.
 *
 * @param analysis - The program's scope analysis
 * @param callee - The callee tested
 * @returns True for the identifier `RegExp` that no declaration shadows
 */
export function isRegExpIdentifier(analysis: ScopeAnalysis, callee: Node): boolean {
  return callee.kind === 'Identifier' && callee.name === 'RegExp' && isGlobalReference(analysis, callee)
}

/**
 * The initialiser of the `const` an identifier reads, when it reads one declared on its own.
 *
 * @param analysis - The program's scope analysis
 * @param identifier - The identifier read
 * @returns The initialiser, or null when the identifier reads no such constant
 */
function constantInitialiser(analysis: ScopeAnalysis, identifier: Node): Node | null {
  const variable = referenceOf(analysis, identifier)?.resolved ?? null
  if (variable === null || variable.defs.length !== 1) return null
  const [def] = variable.defs
  if (def?.kind !== 'Variable' || (def.parent as Node).variableKind !== 'const' || def.node.id !== def.name) return null
  return def.node.init as Node | null
}

/**
 * Whether an expression is the language's `RegExp`: the identifier itself, a `RegExp` member of
 * the global object, or a constant holding one of these.
 *
 * @param analysis - The program's scope analysis
 * @param node - The expression tested
 * @param visiting - The initialisers being followed, against a constant defined by itself
 * @returns True when the expression is the language's `RegExp`
 */
export function isRegExpReference(analysis: ScopeAnalysis, node: Node, visiting: Set<Node> = createSet<Node>()): boolean {
  if (node.kind === 'Identifier') {
    if (node.name === 'RegExp') return isGlobalReference(analysis, node)
    const init = constantInitialiser(analysis, node)
    if (init === null || visiting.has(init)) return false
    visiting.add(init)
    return isRegExpReference(analysis, init, visiting)
  }
  if (node.kind !== 'MemberExpression' || node.computed === true) return false
  const object = node.object as Node
  return (
    (node.property as Node).name === 'RegExp' &&
    object.kind === 'Identifier' &&
    GLOBAL_OBJECTS.has(object.name as string) &&
    isGlobalReference(analysis, object)
  )
}

/**
 * Whether a tag is the language's `String.raw`.
 *
 * @param analysis - The program's scope analysis
 * @param tag - The tag of a tagged template
 * @returns True for `String.raw` with the language's `String`
 */
function isStringRaw(analysis: ScopeAnalysis, tag: Node): boolean {
  if (tag.kind !== 'MemberExpression' || tag.computed === true) return false
  const object = tag.object as Node
  return (
    (tag.property as Node).name === 'raw' && object.kind === 'Identifier' && object.name === 'String' && isGlobalReference(analysis, object)
  )
}

/**
 * The string a template holds, when every substitution is a constant string.
 *
 * @param analysis - The program's scope analysis
 * @param template - The template literal
 * @param visiting - The initialisers being followed
 * @returns The string, or null
 */
function templateString(analysis: ScopeAnalysis, template: Node, visiting: Set<Node>): string | null {
  const quasis = template.quasis as readonly Node[]
  const expressions = template.expressions as readonly Node[]
  let text = ((quasis[0] as Node).value as TemplateValue).cooked as string
  for (let index = 0; index < expressions.length; index += 1) {
    const part = constantString(analysis, expressions[index] as Node, visiting)
    if (part === null) return null
    text += part + (((quasis[index + 1] as Node).value as TemplateValue).cooked as string)
  }
  return text
}

/**
 * The string an expression is known to hold: a string literal, a template whose substitutions
 * are known strings, a `String.raw` template without substitutions, a `+` of two known strings,
 * or a constant initialised to one of these.
 *
 * @param analysis - The program's scope analysis
 * @param node - The expression read
 * @param visiting - The initialisers being followed, against a constant defined by itself
 * @returns The string, or null when it cannot be known
 */
export function constantString(analysis: ScopeAnalysis, node: Node, visiting: Set<Node> = createSet<Node>()): string | null {
  switch (node.kind) {
    case 'Literal':
      return stringLiteralValue(node)
    case 'TemplateLiteral':
      return templateString(analysis, node, visiting)
    case 'TaggedTemplateExpression': {
      const quasi = node.quasi as Node
      if (!isStringRaw(analysis, node.tag as Node) || (quasi.expressions as readonly Node[]).length > 0) return null
      return (((quasi.quasis as readonly Node[])[0] as Node).value as TemplateValue).raw
    }
    case 'BinaryExpression': {
      if (node.operator !== '+') return null
      const left = constantString(analysis, node.left as Node, visiting)
      const right = left === null ? null : constantString(analysis, node.right as Node, visiting)
      return left === null || right === null ? null : left + right
    }
    case 'Identifier': {
      const init = constantInitialiser(analysis, node)
      if (init === null || visiting.has(init)) return null
      visiting.add(init)
      return constantString(analysis, init, visiting)
    }
    default:
      return null
  }
}
