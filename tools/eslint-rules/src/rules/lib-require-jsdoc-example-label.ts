import type { TSESTree } from '@typescript-eslint/utils'
import type { SourceCode } from '@typescript-eslint/utils/ts-eslint'
import { ESLintUtils } from '@typescript-eslint/utils'
import { isPublishableLibrary } from '../utils/nx-project'
import { findProjectRoot } from '../utils/workspace'

/**
 * Rule identifier for the lib-require-jsdoc-example-label rule.
 */
export const RULE_NAME = 'lib-require-jsdoc-example-label'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

/**
 * Message identifiers for the lib-require-jsdoc-example-label rule.
 */
type MessageIds = 'missingLabel'

/**
 * The example tag to detect in JSDoc comments.
 */
const EXAMPLE_TAG = '@example'

/**
 * Result of inspecting a single `@example` tag in a JSDoc comment.
 */
type ExampleLabelInfo = {
  /** Whether the `@example` tag has a descriptive label. */
  hasLabel: boolean
}

/**
 * Extracts all `@example` occurrences from a JSDoc comment and checks if they have labels.
 * A label is non-whitespace text on the same line as `@example`.
 *
 * @param comment - The JSDoc comment text to analyze.
 * @returns Array of objects indicating whether each `@example` has a label.
 */
function analyzeExampleLabels(comment: string): Array<ExampleLabelInfo> {
  const results: Array<ExampleLabelInfo> = []
  const lines = comment.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line === undefined) continue
    const trimmed = line.replace(/^\s*\*\s?/, '') // why: Remove leading * from JSDoc line
    const lowerTrimmed = trimmed.toLowerCase()
    const exampleIndex = lowerTrimmed.indexOf(EXAMPLE_TAG)

    if (exampleIndex !== -1) {
      // note: Check if @example is a complete tag (not part of another word)
      const charAfter = trimmed[exampleIndex + EXAMPLE_TAG.length]
      // istanbul ignore next -- \n and \r are unreachable since we split by newlines
      const isCompleteTag = charAfter === undefined || charAfter === ' ' || charAfter === '\t' || charAfter === '\n' || charAfter === '\r'

      if (isCompleteTag) {
        // note: Check for label text after @example on the same line
        const afterTag = trimmed.slice(exampleIndex + EXAMPLE_TAG.length).trim()
        const hasLabel = afterTag.length > 0 && !afterTag.startsWith('```')
        results.push({ hasLabel })
      }
    }
  }

  return results
}

/**
 * Gets the leading JSDoc comment for a node.
 *
 * @param sourceCode - ESLint source code object for comment retrieval.
 * @param node - AST node to get leading comments for.
 * @returns The JSDoc comment if found, undefined otherwise.
 */
function getLeadingJsDocComment(sourceCode: Readonly<SourceCode>, node: TSESTree.Node): TSESTree.Comment | undefined {
  const comments = sourceCode.getCommentsBefore(node)
  if (comments.length === 0) return undefined

  const lastComment = comments[comments.length - 1]
  if (!lastComment || lastComment.type !== 'Block') return undefined
  if (!lastComment.value.startsWith('*')) return undefined

  return lastComment
}

/**
 * Checks if a node is an exported function declaration.
 *
 * @param node - The node to check.
 * @returns True if the node is an exported function.
 */
function isExportedFunction(node: TSESTree.Node): node is TSESTree.FunctionDeclaration {
  if (node.type !== 'FunctionDeclaration') return false
  const parent = node.parent
  return parent?.type === 'ExportNamedDeclaration' || parent?.type === 'ExportDefaultDeclaration'
}

/**
 * Checks if a node is an exported class declaration.
 *
 * @param node - The node to check.
 * @returns True if the node is an exported class.
 */
function isExportedClass(node: TSESTree.Node): node is TSESTree.ClassDeclaration {
  if (node.type !== 'ClassDeclaration') return false
  const parent = node.parent
  return parent?.type === 'ExportNamedDeclaration' || parent?.type === 'ExportDefaultDeclaration'
}

/**
 * Checks if a variable declaration is exported and contains a function.
 *
 * @param node - Variable declaration to check for exported function patterns.
 * @returns True if the variable declaration is exported and contains a function.
 */
function isExportedFunctionVariable(node: TSESTree.VariableDeclaration): boolean {
  const parent = node.parent
  if (parent?.type !== 'ExportNamedDeclaration') return false

  return node.declarations.some((decl) => {
    const init = decl.init
    return init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression'
  })
}

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require @example JSDoc tags to have descriptive labels in publishable libraries for documentation clarity.',
    },
    schema: [],
    messages: {
      missingLabel:
        '@example blocks must include a descriptive label on the same line (e.g., "@example Basic usage"). Labels help readers understand what each example demonstrates.',
    },
  },
  defaultOptions: [],
  create(context) {
    const projectRoot = findProjectRoot(context.filename)

    if (!projectRoot || !isPublishableLibrary(projectRoot)) {
      return {}
    }

    const sourceCode = context.sourceCode ?? context.getSourceCode()

    /**
     * Reports a missing label error for a JSDoc comment.
     *
     * @param comment - The JSDoc comment AST node.
     */
    function reportMissingLabel(comment: TSESTree.Comment): void {
      context.report({
        loc: comment.loc,
        messageId: 'missingLabel',
      })
    }

    /**
     * Validates that all `@example` tags in a JSDoc comment have labels.
     *
     * @param node - Declaration AST node to validate.
     */
    function checkDeclaration(node: TSESTree.Node): void {
      const jsDoc = getLeadingJsDocComment(sourceCode, node.parent ?? node)
      if (!jsDoc) return

      const examples = analyzeExampleLabels(jsDoc.value)
      const hasUnlabeledExample = examples.some((ex) => !ex.hasLabel)

      if (hasUnlabeledExample) {
        reportMissingLabel(jsDoc)
      }
    }

    return {
      FunctionDeclaration(node) {
        if (!isExportedFunction(node)) return
        checkDeclaration(node)
      },

      ClassDeclaration(node) {
        if (!isExportedClass(node)) return
        checkDeclaration(node)
      },

      VariableDeclaration(node) {
        if (!isExportedFunctionVariable(node)) return

        for (const decl of node.declarations) {
          const init = decl.init
          if (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression') {
            const jsDoc = getLeadingJsDocComment(sourceCode, node.parent ?? node)
            if (!jsDoc) continue

            const examples = analyzeExampleLabels(jsDoc.value)
            const hasUnlabeledExample = examples.some((ex) => !ex.hasLabel)

            if (hasUnlabeledExample) {
              reportMissingLabel(jsDoc)
            }
          }
        }
      },
    }
  },
})
