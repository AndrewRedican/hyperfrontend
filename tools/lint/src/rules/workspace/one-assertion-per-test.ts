/**
 * A test body asserts one behaviour. Every `expect` and `node:assert` call written in the body
 * counts, nested callbacks included, as does every assertion a same-file helper reaches when the
 * body references it; nested tests and suites are a boundary. A body with more than one is
 * reported on the declaring callee, naming where the assertions are.
 *
 * @module rules/workspace/one-assertion-per-test
 */

import type { Node } from '../../code/model.ts'
import type { RuleContext } from '../../engine/rule.ts'
import type { Reference } from '../../scope/model.ts'
import { dirname, posix, relative, sep } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { childrenOf } from '../../code/children.ts'
import { defineRule } from '../../engine/rule.ts'
import { scopeAnalysisOf } from '../../scope/analysis.ts'
import { positionAt } from '../../text/lines.ts'
import { workspaceRootOf } from './shared/locate.ts'
import { suiteDeclaration, testDeclaration } from './shared/tests.ts'

/** The rule's options. */
export interface OneAssertionOptions {
  /** Workspace-relative globs naming the files left alone. */
  readonly exclude?: readonly string[]
}

/** The assertions a helper reference adds. */
interface Through {
  /** The helper's name as referenced. */
  readonly name: string
  /** The line of the reference. */
  readonly line: number
  /** How many assertions the helper reaches. */
  readonly count: number
}

/** The assertions a function body reaches. */
interface Tally {
  /** The lines of the assertions written in the body, in source order. */
  readonly lines: number[]
  /** The helper references, in source order, each with what it adds. */
  readonly through: Through[]
}

/** What a callee identifier stands for. */
type Binding = 'expect' | 'assert-object' | 'assert-function' | null

/** The kinds of node that are a function with a body of its own. */
const FUNCTIONS = createSet<string>(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])

/** The kinds of import specifier, whose source the declaration carries. */
const SPECIFIERS = createSet<string>(['ImportSpecifier', 'ImportDefaultSpecifier', 'ImportNamespaceSpecifier'])

/** The modules of the `node:assert` family. */
const ASSERT_MODULES = createSet<string>(['assert', 'assert/strict', 'node:assert', 'node:assert/strict'])

/** The members of `expect` that start an assertion rather than build a matcher. */
const EXPECT_STARTERS = createSet<string>(['soft', 'poll'])

/**
 * The message, with the count and the places filled in.
 *
 * @param count - How many assertions the test holds
 * @param where - The lines they sit on, listed
 * @returns The message text
 */
const MESSAGE = (count: number, where: string): string =>
  `A test body asserts one behaviour, but this one holds ${count} assertions (${where}). Split it into focused tests, each named for the single behaviour it asserts; when the checks jointly describe one indivisible behaviour, fold them into one assertion with a composite or asymmetric matcher such as expect.objectContaining.`

/**
 * Whether the file is one the options exclude: a workspace-relative path one of the globs matches.
 *
 * @param context - The rule's context
 * @returns True when the rule leaves the file alone
 */
function isExcluded(context: RuleContext<OneAssertionOptions | undefined, Node>): boolean {
  const exclude = context.options?.exclude ?? []
  if (exclude.length === 0) return false
  const root = workspaceRootOf(dirname(context.file.path))
  if (root === null) return false
  const path = relative(root, context.file.path).split(sep).join(posix.sep)
  return exclude.some((pattern) => posix.matchesGlob(path, pattern))
}

/**
 * The name an import specifier imports.
 *
 * @param specifier - The specifier examined
 * @returns The imported name, or `default` or `*` for the other specifier kinds
 */
function importedName(specifier: Node): string {
  if (specifier.kind === 'ImportDefaultSpecifier') return 'default'
  if (specifier.kind === 'ImportNamespaceSpecifier') return '*'
  const imported = specifier.imported as Node
  return imported.kind === 'Identifier' ? (imported.name as string) : (imported.value as string)
}

/**
 * Counts the assertions the tests of one file reach.
 */
class Counter {
  /** The references by the identifier making them. */
  private readonly references = createMap<Node, Reference>()
  /** The file's line map. */
  private readonly context: RuleContext<OneAssertionOptions | undefined, Node>

  /**
   * Reads the file's scope analysis once.
   *
   * @param context - The rule's context
   */
  constructor(context: RuleContext<OneAssertionOptions | undefined, Node>) {
    this.context = context
    for (const scope of scopeAnalysisOf(context).scopes) {
      for (const reference of scope.references) this.references.set(reference.identifier, reference)
    }
  }

  /**
   * The function a referenced name is bound to in this file: a declared function with a body,
   * or a variable initialised with a function.
   *
   * @param identifier - The identifier referencing it
   * @returns The function, or null
   */
  helperOf(identifier: Node): Node | null {
    const definition = this.references.get(identifier)?.resolved?.defs[0]
    if (definition === undefined) return null
    if (definition.kind === 'FunctionName') return FUNCTIONS.has(definition.node.kind) ? definition.node : null
    if (definition.kind !== 'Variable') return null
    const init = definition.node.init as Node | null
    return init !== null && FUNCTIONS.has(init.kind) ? init : null
  }

  /**
   * What a callee identifier stands for: `expect` by name or by import, an object of the
   * `node:assert` family, or one of its functions imported by name.
   *
   * @param identifier - The callee or the object of the callee
   * @returns The binding, or null
   */
  bindingOf(identifier: Node): Binding {
    const definition = this.references.get(identifier)?.resolved?.defs[0]
    if (definition === undefined || !SPECIFIERS.has(definition.node.kind)) return identifier.name === 'expect' ? 'expect' : null
    const imported = importedName(definition.node)
    if (imported === 'expect') return 'expect'
    if (!ASSERT_MODULES.has(((definition.parent as Node).source as Node).value as string)) return null
    return imported === 'default' || imported === '*' || imported === 'strict' ? 'assert-object' : 'assert-function'
  }

  /**
   * Whether a call is an assertion.
   *
   * @param call - The call examined
   * @returns True for `expect(...)`, `expect.soft(...)`, `expect.poll(...)` and the `node:assert` family
   */
  isAssertion(call: Node): boolean {
    const callee = call.callee as Node
    if (callee.kind === 'Identifier') return this.bindingOf(callee) !== null
    if (callee.kind !== 'MemberExpression' || (callee.object as Node).kind !== 'Identifier') return false
    const binding = this.bindingOf(callee.object as Node)
    if (binding === 'assert-object') return true
    return binding === 'expect' && callee.computed !== true && EXPECT_STARTERS.has((callee.property as Node).name as string)
  }

  /**
   * The assertions a function reaches.
   *
   * @param body - The function
   * @param visiting - The functions being counted, which a reference back to adds nothing
   * @returns The lines asserted on and the helpers referenced
   */
  tally(body: Node, visiting: ReadonlySet<Node>): Tally {
    const found: Tally = { lines: [], through: [] }
    const visit = (node: Node): void => {
      if (node.kind === 'CallExpression') {
        if (testDeclaration(node) !== null || suiteDeclaration(node) !== null) return
        if (this.isAssertion(node)) found.lines.push(positionAt(this.context.file.lines, node.start).line)
      } else if (node.kind === 'FunctionDeclaration') {
        return
      } else if (node.kind === 'VariableDeclarator' && FUNCTIONS.has((node.init as Node | null)?.kind ?? '')) {
        return
      } else if (node.kind === 'Identifier') {
        this.reach(node, visiting, found)
      }
      for (const child of childrenOf(node)) visit(child)
    }
    visit(body.body as Node)
    return found
  }

  /**
   * Adds what a reference to a same-file helper reaches.
   *
   * @param identifier - The identifier referencing it
   * @param visiting - The functions being counted
   * @param found - Where the reference is recorded
   */
  private reach(identifier: Node, visiting: ReadonlySet<Node>, found: Tally): void {
    const helper = this.helperOf(identifier)
    if (helper === null || visiting.has(helper)) return
    const inner = this.tally(helper, createSet<Node>([...visiting, helper]))
    const count = total(inner)
    if (count > 0)
      found.through.push({ name: identifier.name as string, line: positionAt(this.context.file.lines, identifier.start).line, count })
  }

  /**
   * The body of a test: the first argument that is a function, or a name bound to one in this file.
   *
   * @param call - The declaring call
   * @returns The function, or null when the body is not readable
   */
  bodyOf(call: Node): Node | null {
    for (const argument of call.arguments as readonly Node[]) {
      if (FUNCTIONS.has(argument.kind)) return argument
      if (argument.kind !== 'Identifier') continue
      const helper = this.helperOf(argument)
      if (helper !== null) return helper
    }
    return null
  }
}

/**
 * How many assertions a tally holds.
 *
 * @param tally - The lines and helper references
 * @returns The lines plus what the helpers add
 */
function total(tally: Tally): number {
  return tally.through.reduce((sum, through) => sum + through.count, tally.lines.length)
}

/**
 * Numbers listed in prose: `1`, `1 and 2`, `1, 2 and 3`.
 *
 * @param numbers - The line numbers listed
 * @returns The list
 */
function listed(numbers: readonly number[]): string {
  if (numbers.length === 1) return `${numbers[0]}`
  return `${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}`
}

/**
 * Where the assertions are: the lines written in the body, then each helper reference.
 *
 * @param tally - The lines and helper references
 * @returns The prose
 */
function where(tally: Tally): string {
  const parts: string[] = []
  const lines = [...createSet(tally.lines)].sort((a, b) => a - b)
  if (lines.length > 0) parts.push(`on line${lines.length > 1 ? 's' : ''} ${listed(lines)}`)
  for (const through of tally.through) parts.push(`${through.count} through ${through.name} (line ${through.line})`)
  return parts.join(', plus ')
}

export default defineRule<OneAssertionOptions | undefined, Node>({
  id: 'workspace/one-assertion-per-test',
  language: 'code',
  fixable: false,
  create(context) {
    if (isExcluded(context)) return {}
    let counter: Counter | null = null
    return {
      CallExpression(node) {
        const callee = testDeclaration(node)
        if (callee === null) return
        counter ??= new Counter(context)
        const body = counter.bodyOf(node)
        if (body === null) return
        const tally = counter.tally(body, createSet<Node>([body]))
        const count = total(tally)
        if (count < 2) return
        context.report({ start: callee.start, end: callee.end, message: MESSAGE(count, where(tally)) })
      },
    }
  },
})
