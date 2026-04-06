import type { TSESTree } from '@typescript-eslint/utils'
import { ESLintUtils } from '@typescript-eslint/utils'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Rule identifier for the max-file-lines rule.
 */
export const RULE_NAME = 'max-file-lines'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

/**
 * Message identifiers for the max-file-lines rule.
 */
type MessageIds = 'fileTooLong'

/**
 * Configuration options for the max-file-lines rule.
 */
export interface RuleOptions {
  /**
   * Maximum number of lines allowed in implementation files.
   * Only applied to files with more than one function.
   *
   * @default 300
   */
  maxLines?: number

  /**
   * Maximum number of lines allowed in test files.
   * Only applied to files with more than one function.
   * Test files are identified by `.spec.ts`, `.test.ts`, `.spec.js`, `.test.js` extensions.
   *
   * @default 500
   */
  maxLinesTest?: number
}

/**
 * Default configuration values.
 */
const DEFAULT_MAX_LINES = 300
const DEFAULT_MAX_LINES_TEST = 500

/**
 * Patterns to identify test files.
 */
const TEST_FILE_PATTERNS = ['.spec.ts', '.test.ts', '.spec.tsx', '.test.tsx', '.spec.js', '.test.js', '.spec.jsx', '.test.jsx']

/**
 * Checks if a file is a test file based on its filename.
 *
 * @param filename - The filename to check.
 * @returns True if the file is a test file.
 */
function isTestFile(filename: string): boolean {
  return TEST_FILE_PATTERNS.some((pattern) => filename.endsWith(pattern))
}

/**
 * Counts the number of function-like nodes in the AST.
 * Includes function declarations, function expressions, arrow functions, and method definitions.
 *
 * @param node - The AST node to traverse.
 * @returns The count of function-like nodes.
 */
function countFunctions(node: TSESTree.Program): number {
  let count = 0

  /**
   * Recursively visits AST nodes to count function-like constructs.
   *
   * @param n - The current AST node being visited.
   */
  function visit(n: TSESTree.Node): void {
    switch (n.type) {
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        count++
        break
    }

    for (const key of keys(n as unknown as Record<string, unknown>)) {
      if (key === 'parent' || key === 'loc' || key === 'range' || key === 'type') continue
      const child = (n as unknown as Record<string, unknown>)[key]
      if (isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && 'type' in item) {
            visit(item as TSESTree.Node)
          }
        }
      } else if (child && typeof child === 'object' && 'type' in child) {
        visit(child as TSESTree.Node)
      }
    }
  }

  visit(node)
  return count
}

export default createRule<[RuleOptions?], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce a maximum file line count for files with multiple functions',
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxLines: {
            type: 'integer',
            minimum: 1,
            description: 'Maximum number of lines allowed in implementation files. Only applied to files with more than one function.',
          },
          maxLinesTest: {
            type: 'integer',
            minimum: 1,
            description: 'Maximum number of lines allowed in test files. Test files are identified by .spec.ts, .test.ts, etc.',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      fileTooLong:
        'File has {{ actualLines }} lines but the maximum allowed is {{ maxLines }}. Consider splitting this file to improve separation of concerns.',
    },
  },
  defaultOptions: [{ maxLines: DEFAULT_MAX_LINES, maxLinesTest: DEFAULT_MAX_LINES_TEST }],
  create(context, [options]) {
    const maxLines = options?.maxLines ?? DEFAULT_MAX_LINES
    const maxLinesTest = options?.maxLinesTest ?? DEFAULT_MAX_LINES_TEST

    return {
      'Program:exit'(node: TSESTree.Program) {
        const functionCount = countFunctions(node)

        if (functionCount <= 1) {
          return
        }

        const filename = context.filename
        const isTest = isTestFile(filename)
        const limit = isTest ? maxLinesTest : maxLines

        const actualLines = node.loc.end.line

        if (actualLines > limit) {
          context.report({
            node,
            messageId: 'fileTooLong',
            data: {
              actualLines: String(actualLines),
              maxLines: String(limit),
            },
          })
        }
      },
    }
  },
})
