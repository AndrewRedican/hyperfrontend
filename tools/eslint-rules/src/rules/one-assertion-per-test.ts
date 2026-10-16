import type { TSESTree } from '@typescript-eslint/utils'
import { dirname, posix } from 'node:path'
import { AST_NODE_TYPES, ESLintUtils, TSESLint } from '@typescript-eslint/utils'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { workspaceRelativePath } from '@hyperfrontend/project-scope/core/path'
import { isSuiteFunctionCallee, isTestFunctionCallee } from '../utils/test-declarations'
import { findWorkspaceRoot } from '../utils/workspace'

/**
 * Rule identifier for the one-assertion-per-test rule.
 */
export const RULE_NAME = 'one-assertion-per-test'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

/**
 * Message identifiers for the one-assertion-per-test rule.
 */
type MessageIds = 'tooManyAssertions'

/**
 * Configuration options for the one-assertion-per-test rule.
 */
export interface RuleOptions {
  /**
   * Workspace-relative globs naming spec files the rule leaves alone, matched with `posix.matchesGlob`
   * from `node:path` against the file's path from the workspace root.
   */
  exclude?: string[]
}

/**
 * A function node whose assertions can be counted.
 */
type FunctionNode = TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression | TSESTree.FunctionDeclaration

/**
 * One reference, inside a test body, to a same-file helper that asserts.
 */
interface HelperUse {
  /** The helper's name as written at the reference. */
  name: string
  /** Line of the reference. */
  line: number
  /** Assertions the helper carries, transitively. */
  count: number
}

/**
 * The assertions a function body reaches.
 */
interface Tally {
  /** Line of every assertion call written directly in the body, nested callbacks included. */
  sites: number[]
  /** Same-file helpers the body references, each with the assertions it adds. */
  helpers: HelperUse[]
}

/**
 * Modules whose every export is an assertion function, or an object of them.
 */
const ASSERT_MODULES = createSet(['node:assert', 'node:assert/strict', 'assert', 'assert/strict'])

/**
 * Members of `expect` that start an assertion rather than build a matcher argument.
 */
const EXPECT_ASSERTION_MEMBERS = createSet(['soft', 'poll'])

/**
 * Determines whether a node is a function whose body can hold assertions.
 *
 * @param node - The node to inspect.
 * @returns True for arrow functions, function expressions and function declarations.
 */
function isFunctionNode(node: TSESTree.Node): node is FunctionNode {
  return (
    node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node.type === AST_NODE_TYPES.FunctionExpression ||
    node.type === AST_NODE_TYPES.FunctionDeclaration
  )
}

/**
 * Reads the function a declared variable is bound to.
 *
 * @param definition - The variable's declaration.
 * @returns The function, or null when the variable holds something else, such as an import or a parameter.
 */
function functionOf(definition: TSESLint.Scope.Definition): FunctionNode | null {
  if (definition.type === TSESLint.Scope.DefinitionType.FunctionName) {
    return isFunctionNode(definition.node) ? definition.node : null
  }
  if (definition.type === TSESLint.Scope.DefinitionType.Variable) {
    const init = definition.node.init
    return init !== null && isFunctionNode(init) ? init : null
  }
  return null
}

/**
 * Determines whether a declaration imports from one of the given modules.
 *
 * @param definition - The variable's declaration.
 * @param modules - Module specifiers to match.
 * @returns True when the binding comes from an `import` of one of the modules.
 */
function isImportedFrom(definition: TSESLint.Scope.Definition, modules: ReadonlySet<string>): boolean {
  return (
    definition.type === TSESLint.Scope.DefinitionType.ImportBinding &&
    definition.parent.type === AST_NODE_TYPES.ImportDeclaration &&
    modules.has(definition.parent.source.value)
  )
}

/**
 * Determines whether a declaration imports `expect` under another local name.
 *
 * @param definition - The variable's declaration.
 * @returns True for `import { expect as e } from ...`.
 */
function isExpectAlias(definition: TSESLint.Scope.Definition): boolean {
  if (definition.type !== TSESLint.Scope.DefinitionType.ImportBinding || definition.node.type !== AST_NODE_TYPES.ImportSpecifier) {
    return false
  }
  const imported = definition.node.imported
  return (imported.type === AST_NODE_TYPES.Identifier ? imported.name : imported.value) === 'expect'
}

/**
 * Lists line numbers as prose: `12`, `12 and 15`, `12, 15 and 18`.
 *
 * @param lines - The lines, in source order.
 * @returns The list as prose.
 */
function listLines(lines: readonly number[]): string {
  if (lines.length === 1) return String(lines[0])
  return `${lines.slice(0, -1).join(', ')} and ${String(lines[lines.length - 1])}`
}

/**
 * Describes where a body's assertions are, for the diagnostic.
 *
 * @param tally - The assertions the body reaches.
 * @returns Prose naming the direct assertion lines and the helpers that add more.
 */
function describeTally(tally: Tally): string {
  const parts: string[] = []
  const lines = [...createSet(tally.sites)]
  if (lines.length > 0) {
    parts.push(`on ${lines.length === 1 ? 'line' : 'lines'} ${listLines(lines)}`)
  }
  for (const helper of tally.helpers) {
    parts.push(`${helper.count} through ${helper.name} (line ${helper.line})`)
  }
  return parts.join(', plus ')
}

/**
 * Sums the assertions a tally reaches.
 *
 * @param tally - The assertions the body reaches.
 * @returns Direct sites plus every helper's contribution.
 */
function totalOf(tally: Tally): number {
  return tally.helpers.reduce((sum, helper) => sum + helper.count, tally.sites.length)
}

/**
 * Decides whether the options exclude a file.
 *
 * @param filename - Absolute path of the file being linted.
 * @param exclude - Workspace-relative globs.
 * @returns True when any glob matches the file's workspace-relative path; false outside a workspace.
 */
function isExcluded(filename: string, exclude: readonly string[]): boolean {
  if (exclude.length === 0) return false
  const workspaceRoot = findWorkspaceRoot(dirname(filename))
  if (workspaceRoot === null) return false
  const file = workspaceRelativePath(workspaceRoot, filename)
  return exclude.some((pattern) => posix.matchesGlob(file, pattern))
}

/**
 * Maps every resolved identifier reference in the file to the variable it names.
 *
 * @param scopeManager - The file's scope analysis.
 * @returns Reference identifiers keyed to their variables; undeclared globals are absent.
 */
function collectReferences(scopeManager: TSESLint.Scope.ScopeManager): Map<TSESTree.Node, TSESLint.Scope.Variable> {
  const references = createMap<TSESTree.Node, TSESLint.Scope.Variable>()
  for (const scope of scopeManager.scopes) {
    for (const reference of scope.references) {
      if (reference.resolved !== null) references.set(reference.identifier, reference.resolved)
    }
  }
  return references
}

export default createRule<[RuleOptions], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Limit each test body to one assertion, counting the assertions reached through same-file helpers',
    },
    schema: [
      {
        type: 'object',
        properties: {
          exclude: {
            type: 'array',
            items: { type: 'string' },
            description: 'Workspace-relative globs naming spec files the rule leaves alone.',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      tooManyAssertions:
        'A test body asserts one behaviour, but this one holds {{ count }} assertions ({{ where }}). Split it into focused tests, each named for the single behaviour it asserts; when the checks jointly describe one indivisible behaviour, fold them into one assertion with a composite or asymmetric matcher such as expect.objectContaining.',
    },
  },
  defaultOptions: [{ exclude: [] }],
  create(context, [options]) {
    if (isExcluded(context.filename, options.exclude ?? [])) return {}

    const sourceCode = context.sourceCode
    const visitorKeys = sourceCode.visitorKeys
    const references = collectReferences(sourceCode.scopeManager as TSESLint.Scope.ScopeManager)
    // why: a helper's total is fixed per file, and a helper that reaches itself must stop at the second visit.
    const helperTotals = createMap<FunctionNode, number | null>()

    /**
     * Reads the declaration an identifier refers to.
     *
     * @param identifier - The identifier, at a reference.
     * @returns The declaration, or null for undeclared globals and implicit bindings such as `arguments`.
     */
    function definitionOf(identifier: TSESTree.Identifier): TSESLint.Scope.Definition | null {
      const variable = references.get(identifier)
      if (variable === undefined) return null
      const [definition] = variable.defs
      return definition ?? null
    }

    /**
     * Reads the same-file function an identifier refers to.
     *
     * @param identifier - The identifier, at a reference.
     * @returns The function, or null when the name is bound to anything else.
     */
    function helperOf(identifier: TSESTree.Identifier): FunctionNode | null {
      const definition = definitionOf(identifier)
      return definition === null ? null : functionOf(definition)
    }

    /**
     * Determines whether a call is an assertion: `expect(...)`, `expect.soft(...)`, `expect.poll(...)`, an
     * aliased `expect`, or any call into the `node:assert` family.
     *
     * @param callee - The call's callee.
     * @returns True when the call asserts.
     */
    function isAssertionCallee(callee: TSESTree.Expression): boolean {
      if (callee.type === AST_NODE_TYPES.Identifier) {
        if (callee.name === 'expect') return true
        const definition = definitionOf(callee)
        return definition !== null && (isImportedFrom(definition, ASSERT_MODULES) || isExpectAlias(definition))
      }
      if (callee.type !== AST_NODE_TYPES.MemberExpression || callee.object.type !== AST_NODE_TYPES.Identifier) return false
      if (callee.object.name === 'expect') {
        return callee.property.type === AST_NODE_TYPES.Identifier && EXPECT_ASSERTION_MEMBERS.has(callee.property.name)
      }
      const definition = definitionOf(callee.object)
      return definition !== null && isImportedFrom(definition, ASSERT_MODULES)
    }

    /**
     * Visits a node and, unless the visit says otherwise, its children.
     *
     * @param node - The node to visit.
     * @param visit - Receives each node; returns false to leave that node's children unvisited.
     */
    function walk(node: TSESTree.Node, visit: (node: TSESTree.Node) => boolean): void {
      if (!visit(node)) return
      walkChildren(node, visit)
    }

    /**
     * Visits a node's children.
     *
     * @param node - The node whose children to visit.
     * @param visit - Receives each node; returns false to leave that node's children unvisited.
     */
    function walkChildren(node: TSESTree.Node, visit: (node: TSESTree.Node) => boolean): void {
      const record = node as unknown as Record<string, unknown>
      for (const key of visitorKeys[node.type] as readonly string[]) {
        const child = record[key]
        if (isArray(child)) {
          for (const item of child as readonly (TSESTree.Node | null)[]) {
            if (item !== null) walk(item, visit)
          }
        } else if (child) {
          walk(child as TSESTree.Node, visit)
        }
      }
    }

    /**
     * Counts the assertions a function reaches: the calls written in it, nested callbacks included, plus
     * the assertions of every same-file function it refers to. Functions bound to a name inside it are
     * counted through their references, so a local helper called twice counts twice. Nested test and suite
     * declarations are left to their own reports.
     *
     * @param fn - The function to count.
     * @returns Where the assertions are.
     */
    function tallyFunction(fn: FunctionNode): Tally {
      const tally: Tally = { sites: [], helpers: [] }
      walkChildren(fn, (node) => {
        if (node.type === AST_NODE_TYPES.CallExpression) {
          if (isTestFunctionCallee(node.callee) || isSuiteFunctionCallee(node.callee)) return false
          if (isAssertionCallee(node.callee)) tally.sites.push(node.loc.start.line)
          return true
        }
        if (node.type === AST_NODE_TYPES.FunctionDeclaration) return false
        if (node.type === AST_NODE_TYPES.VariableDeclarator) {
          return !(node.id.type === AST_NODE_TYPES.Identifier && node.init !== null && isFunctionNode(node.init))
        }
        if (node.type === AST_NODE_TYPES.Identifier) {
          const helper = helperOf(node)
          const count = helper === null ? 0 : helperTotal(helper)
          if (count > 0) tally.helpers.push({ name: node.name, line: node.loc.start.line, count })
        }
        return true
      })
      return tally
    }

    /**
     * Counts the assertions a helper reaches, once per file.
     *
     * @param fn - The same-file function a test body referred to.
     * @returns Its total, or zero while the helper is already being counted higher up the stack.
     */
    function helperTotal(fn: FunctionNode): number {
      const known = helperTotals.get(fn)
      if (known !== undefined) return known ?? 0
      helperTotals.set(fn, null)
      const total = totalOf(tallyFunction(fn))
      helperTotals.set(fn, total)
      return total
    }

    /**
     * Finds the body of a test declaration: the first argument that is a function, or a name bound to a
     * same-file function.
     *
     * @param call - The test declaration.
     * @returns The body, or null when the test has none the rule can read.
     */
    function bodyOf(call: TSESTree.CallExpression): FunctionNode | null {
      for (const argument of call.arguments) {
        if (isFunctionNode(argument)) return argument
        if (argument.type === AST_NODE_TYPES.Identifier) {
          const helper = helperOf(argument)
          if (helper !== null) return helper
        }
      }
      return null
    }

    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (!isTestFunctionCallee(node.callee)) return
        const body = bodyOf(node)
        if (body === null) return
        const tally = tallyFunction(body)
        const count = totalOf(tally)
        if (count <= 1) return
        context.report({
          node: node.callee,
          messageId: 'tooManyAssertions',
          data: { count: String(count), where: describeTally(tally) },
        })
      },
    }
  },
})
