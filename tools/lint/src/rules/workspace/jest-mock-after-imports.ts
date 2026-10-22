/**
 * A spec registers its mocks after its imports: the test runner's load hook finds
 * `jest.mock()` and `jest.unmock()` wherever they sit, so the import block stays at the top
 * where readers expect it. The fix moves the imports above the mocks when nothing else sits
 * among them.
 *
 * @module rules/workspace/jest-mock-after-imports
 */

import type { Node } from '../../code/model.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule.ts'
import { isContiguous, rewriteRun } from './shared/ordering.ts'

/** The `jest` methods that register a mock. */
const MOCK_METHODS = createSet<string>(['mock', 'unmock'])

/**
 * The mock method a statement calls, when it is `jest.mock(...)` or `jest.unmock(...)`.
 *
 * @param statement - A top-level statement
 * @returns The method name, or null for any other statement
 */
function mockMethodOf(statement: Node): string | null {
  if (statement.kind !== 'ExpressionStatement') return null
  const expression = statement.expression as Node
  if (expression.kind !== 'CallExpression') return null
  const callee = expression.callee as Node
  if (callee.kind !== 'MemberExpression' || callee.computed === true) return null
  const object = callee.object as Node
  const property = callee.property as Node
  if (object.kind !== 'Identifier' || object.name !== 'jest' || property.kind !== 'Identifier') return null
  const method = property.name as string
  return MOCK_METHODS.has(method) ? method : null
}

export default defineRule<undefined, Node>({
  id: 'workspace/jest-mock-after-imports',
  language: 'code',
  fixable: true,
  create: (context) => ({
    Program(node) {
      const body = node.body as readonly Node[]
      const run = body.filter((statement) => statement.kind === 'ImportDeclaration' || mockMethodOf(statement) !== null)
      const imports = run.filter((statement) => statement.kind === 'ImportDeclaration')
      const mocks = run.filter((statement) => statement.kind !== 'ImportDeclaration')
      const lastImport = imports[imports.length - 1]
      if (lastImport === undefined) return
      const misplaced = mocks.filter((mock) => mock.start < lastImport.start)
      if (misplaced.length === 0) return
      const fix = isContiguous(body, run) ? rewriteRun(context.file, run, [...imports, ...mocks]) : undefined
      for (const mock of misplaced) {
        context.report({
          start: mock.start,
          end: mock.end,
          message: `jest.${mockMethodOf(mock) as string}() must be placed after all import statements.`,
          fix,
        })
      }
    },
  }),
})
