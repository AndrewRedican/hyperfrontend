/**
 * Declarations the configuration names carry a JSDoc block: function declarations always, and
 * the contexts the options list, such as exported functions, interfaces and public members. The
 * fix inserts an empty block before the declaration.
 *
 * @module rules/jsdoc/require-jsdoc
 */

import type { Node } from '../../code/model'
import type { Fix } from '../../engine/report'
import type { RuleContext } from '../../engine/rule'
import type { Listeners } from '../../engine/traverse'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule'
import { reducedNode } from '../../jsdoc/attach'
import { positionAt } from '../../text/lines'
import { memberKindOf } from './shared/exemptions'
import { jsdocWithOverloads } from './shared/overloads'
import { returnsValue } from './shared/returns'

/** The contexts the options may name, each a kind of declaration that needs a block. */
export type Context =
  | 'exported-function'
  | 'exported-default-function'
  | 'exported-class'
  | 'exported-default-class'
  | 'exported-arrow-variable'
  | 'exported-function-variable'
  | 'interface'
  | 'type-alias'
  | 'property-signature'
  | 'method-signature'
  | 'public-method'
  | 'public-method-signature'
  | 'public-property'
  | 'public-abstract-method'
  | 'public-abstract-property'

/** The options the rule takes. */
export interface Options {
  /** The contexts checked beside function declarations. */
  readonly contexts?: readonly Context[]
  /** Whether constructors are checked; true unless given. */
  readonly checkConstructors?: boolean
  /** Whether a constructor without parameters or return value is let go; false unless given. */
  readonly exemptEmptyConstructors?: boolean
  /** Whether getters are checked; true unless given. */
  readonly checkGetters?: boolean
  /** Whether setters are checked, or only those without a getter of the same name; true unless given. */
  readonly checkSetters?: boolean | 'no-getter'
}

/** A context: the node kind it is reached at and whether a node of that kind is in it. */
interface ContextTest {
  /** The kind of node listened for. */
  readonly kind: string
  /** Whether the node is in the context. */
  readonly test: (node: Node) => boolean
}

/**
 * Whether a node's parent has a given kind.
 *
 * @param node - The node whose parent is tested
 * @param kind - The kind expected
 * @returns Whether the parent has it
 */
function parentIs(node: Node, kind: string): boolean {
  return (node.parent as Node).kind === kind
}

/**
 * Whether a function is the value of a variable an export declares: `export const f = ...`.
 *
 * @param node - The function
 * @returns Whether it is an exported variable's initialiser
 */
function isExportedVariable(node: Node): boolean {
  const declarator = node.parent as Node
  const declaration = declarator.parent as Node
  return (
    declarator.kind === 'VariableDeclarator' &&
    declaration.kind === 'VariableDeclaration' &&
    parentIs(declaration, 'ExportNamedDeclaration')
  )
}

/**
 * Whether a class member is public: not marked private, not named by a private identifier.
 *
 * @param member - The class member tested
 * @returns Whether it is public
 */
function isPublic(member: Node): boolean {
  return member.accessibility !== 'private' && (member.key as Node).kind !== 'PrivateIdentifier'
}

/**
 * Whether a method definition follows an overload signature, being the implementation the
 * signature documents.
 *
 * @param member - The method definition
 * @returns Whether the member before it is a method signature
 */
function followsSignature(member: Node): boolean {
  const members = (member.parent as Node).body as readonly Node[]
  const previous = members[members.indexOf(member) - 1]
  return previous?.kind === 'MethodDefinition' && (previous.value as Node).kind === 'TSEmptyBodyFunctionExpression'
}

/** The contexts by name. */
const CONTEXTS: Readonly<Record<Context, ContextTest>> = {
  'exported-function': { kind: 'FunctionDeclaration', test: (node) => parentIs(node, 'ExportNamedDeclaration') },
  'exported-default-function': { kind: 'FunctionDeclaration', test: (node) => parentIs(node, 'ExportDefaultDeclaration') },
  'exported-class': { kind: 'ClassDeclaration', test: (node) => parentIs(node, 'ExportNamedDeclaration') },
  'exported-default-class': { kind: 'ClassDeclaration', test: (node) => parentIs(node, 'ExportDefaultDeclaration') },
  'exported-arrow-variable': { kind: 'ArrowFunctionExpression', test: isExportedVariable },
  'exported-function-variable': { kind: 'FunctionExpression', test: isExportedVariable },
  interface: { kind: 'TSInterfaceDeclaration', test: () => true },
  'type-alias': { kind: 'TSTypeAliasDeclaration', test: () => true },
  'property-signature': { kind: 'TSPropertySignature', test: () => true },
  'method-signature': { kind: 'TSMethodSignature', test: () => true },
  'public-method': {
    kind: 'FunctionExpression',
    test: (node) => parentIs(node, 'MethodDefinition') && isPublic(node.parent as Node) && !followsSignature(node.parent as Node),
  },
  'public-method-signature': {
    kind: 'TSEmptyBodyFunctionExpression',
    test: (node) => parentIs(node, 'MethodDefinition') && isPublic(node.parent as Node),
  },
  'public-property': { kind: 'PropertyDefinition', test: isPublic },
  'public-abstract-method': { kind: 'TSAbstractMethodDefinition', test: (node) => node.accessibility !== 'private' },
  'public-abstract-property': { kind: 'TSAbstractPropertyDefinition', test: (node) => node.accessibility !== 'private' },
}

/**
 * The name of a class member's key, for matching a setter with its getter.
 *
 * @param member - The getter or setter
 * @returns The key's name or literal value
 */
function keyName(member: Node): unknown {
  const key = member.key as Node
  return key.kind === 'Identifier' ? key.name : key.value
}

/**
 * Whether the rule lets a member go by its kind: a constructor, getter or setter the options do
 * not check, or a constructor with nothing to document.
 *
 * @param node - The node checked
 * @param options - The configured checks
 * @returns Whether no block is required
 */
function isExempt(node: Node, options: Options): boolean {
  const kind = memberKindOf(node)
  if (kind === 'constructor') {
    if (options.checkConstructors === false) return true
    return options.exemptEmptyConstructors === true && (node.params as readonly Node[]).length === 0 && !returnsValue(node)
  }
  if (kind === 'get') return options.checkGetters === false
  if (kind !== 'set') return false
  const checkSetters = options.checkSetters ?? true
  if (checkSetters !== 'no-getter') return !checkSetters
  const member = node.parent as Node
  const members = (member.parent as Node).body as readonly Node[]
  return members.some((other) => other.methodKind === 'get' && keyName(other) === keyName(member))
}

/**
 * The fix inserting an empty block before the declaration holding a node, or before its first
 * decorator, indented as the line it starts on.
 *
 * @param context - The rule's context
 * @param node - The node documented
 * @returns The insertion
 */
function insertBlock(context: RuleContext<Options | undefined, Node>, node: Node): Fix {
  const base = reducedNode(context.file, context.tree, node)
  const declaration = base.declaration as Node | null | undefined
  const decorators = (declaration?.decorators ?? base.decorators ?? (base.parent as Node).decorators) as readonly Node[] | undefined
  const at = decorators?.[0]?.start ?? base.start
  const { text } = context.file
  const lineStart = text.lastIndexOf('\n', at - 1) + 1
  let end = lineStart
  while (text[end] === ' ' || text[end] === '\t') end += 1
  const indent = text.slice(lineStart, end)
  return { start: at, end: at, text: `/**\n${indent} *\n${indent} */\n${indent}` }
}

export default defineRule<Options | undefined, Node>({
  id: 'jsdoc/require-jsdoc',
  language: 'code',
  fixable: true,
  create(context) {
    const options = context.options ?? {}
    const fixed = createSet<Node>()
    const check = (node: Node): void => {
      if (jsdocWithOverloads(context, node) !== null || isExempt(node, options)) return
      const { line, column } = positionAt(context.file.lines, node.start)
      // why: a node two contexts name is reported twice, as the previous linter did, but one block is inserted.
      const fix = fixed.has(node) ? undefined : insertBlock(context, node)
      fixed.add(node)
      context.report({
        start: node.start,
        end: node.end,
        at: { line, column, endLine: line + 1, endColumn: 1 },
        message: 'Missing JSDoc comment.',
        fix,
      })
    }
    const tests: ContextTest[] = [
      { kind: 'FunctionDeclaration', test: () => true },
      ...(options.contexts ?? []).map((name) => CONTEXTS[name]),
    ]
    const listeners: Record<string, (node: Node) => void> = {}
    for (const kind of createSet(tests.map((item) => item.kind))) {
      const relevant = tests.filter((item) => item.kind === kind)
      listeners[kind] = (node) => {
        for (const item of relevant) if (item.test(node)) check(node)
      }
    }
    return listeners as Listeners<Node>
  },
})
