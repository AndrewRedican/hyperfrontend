import type { TSESTree } from '@typescript-eslint/utils'
import type { SourceCode } from '@typescript-eslint/utils/ts-eslint'
import { ESLintUtils } from '@typescript-eslint/utils'
import { isPublishableLibrary } from '../utils/nx-project'
import { findProjectRoot } from '../utils/workspace'

/**
 * Rule identifier for the lib-require-jsdoc-example rule.
 */
export const RULE_NAME = 'lib-require-jsdoc-example'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

/**
 * Message identifiers for the lib-require-jsdoc-example rule.
 */
type MessageIds = 'missingExample'

/**
 * The example tag to detect in JSDoc comments.
 */
const EXAMPLE_TAG = '@example'

/**
 * Checks if a JSDoc comment contains an example tag.
 *
 * @param comment - The comment text to check.
 * @returns True if the comment contains an example tag.
 */
function hasExampleTag(comment: string): boolean {
  const lowerComment = comment.toLowerCase()
  const index = lowerComment.indexOf(EXAMPLE_TAG)
  if (index === -1) return false

  const charAfter = comment[index + EXAMPLE_TAG.length]
  return charAfter === undefined || charAfter === ' ' || charAfter === '\t' || charAfter === '\n' || charAfter === '\r'
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
      description: 'Require @example JSDoc tag on exported functions and classes in publishable libraries for documentation quality.',
    },
    schema: [],
    messages: {
      missingExample:
        'Exported API must include an @example block in its JSDoc comment. Examples improve documentation quality and help users understand usage patterns.',
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
     * Reports a missing example error for a node.
     *
     * @param node - AST node to report the error on.
     * @param name - Export identifier for error context.
     */
    function reportMissingExample(node: TSESTree.Node, name: string | undefined): void {
      context.report({
        node,
        messageId: 'missingExample',
        data: { name: name ?? 'export' },
      })
    }

    /**
     * Validates that a declaration includes `@example` in its JSDoc and reports if absent.
     *
     * @param node - Declaration AST node to validate.
     * @param name - Export identifier for error context.
     */
    function checkDeclaration(node: TSESTree.Node, name: string | undefined): void {
      const jsDoc = getLeadingJsDocComment(sourceCode, node.parent ?? node)
      if (!jsDoc) {
        reportMissingExample(node, name)
        return
      }

      if (!hasExampleTag(jsDoc.value)) {
        reportMissingExample(node, name)
      }
    }

    return {
      FunctionDeclaration(node) {
        if (!isExportedFunction(node)) return
        checkDeclaration(node, node.id?.name)
      },

      ClassDeclaration(node) {
        if (!isExportedClass(node)) return
        checkDeclaration(node, node.id?.name)
      },

      VariableDeclaration(node) {
        if (!isExportedFunctionVariable(node)) return

        for (const decl of node.declarations) {
          const init = decl.init
          if (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression') {
            const name = decl.id.type === 'Identifier' ? decl.id.name : undefined
            const jsDoc = getLeadingJsDocComment(sourceCode, node.parent ?? node)

            if (!jsDoc || !hasExampleTag(jsDoc.value)) {
              reportMissingExample(decl, name)
            }
          }
        }
      },
    }
  },
})
