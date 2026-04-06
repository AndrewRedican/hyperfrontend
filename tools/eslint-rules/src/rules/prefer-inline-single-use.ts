import type { TSESTree } from '@typescript-eslint/utils'
import { ESLintUtils } from '@typescript-eslint/utils'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Rule identifier for the prefer-inline-single-use rule.
 */
export const RULE_NAME = 'prefer-inline-single-use'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

/**
 * Message identifiers for the prefer-inline-single-use rule.
 */
type MessageIds = 'preferInline'

/**
 * Options configuration for the prefer-inline-single-use rule.
 */
type Options = readonly []

/**
 * Checks if a node is a simple, safe-to-inline expression.
 * Excludes function calls, await, yield, and other expressions with side effects.
 *
 * @param node - The AST node to check.
 * @returns True if the expression is safe to inline.
 */
function isSafeToInline(node: TSESTree.Node): boolean {
  switch (node.type) {
    case 'Literal':
    case 'Identifier':
    case 'TemplateLiteral':
      return true
    case 'ArrayExpression':
      return node.elements.every((el) => el === null || (el.type !== 'SpreadElement' && isSafeToInline(el)))
    case 'ObjectExpression':
      return node.properties.every(
        (prop) =>
          prop.type === 'Property' &&
          !prop.computed &&
          isSafeToInline(prop.value) &&
          (prop.key.type === 'Identifier' || prop.key.type === 'Literal')
      )
    case 'MemberExpression':
      return isSafeToInline(node.object)
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      return true
    case 'BinaryExpression':
    case 'LogicalExpression':
      return isSafeToInline(node.left) && isSafeToInline(node.right)
    case 'UnaryExpression':
      return isSafeToInline(node.argument)
    case 'ConditionalExpression':
      return isSafeToInline(node.test) && isSafeToInline(node.consequent) && isSafeToInline(node.alternate)
    case 'TSAsExpression':
    case 'TSNonNullExpression':
    case 'TSTypeAssertion':
      return isSafeToInline(node.expression)
    default:
      return false
  }
}

/**
 * Checks if a reference needs parentheses when inlined.
 *
 * @param initNode - The initializer expression node.
 * @param referenceParent - The parent node of the reference.
 * @param refNode - The reference identifier node.
 * @returns True if parentheses are needed when inlining.
 */
function needsParentheses(
  initNode: TSESTree.Expression,
  referenceParent: TSESTree.Node | undefined,
  refNode: TSESTree.Identifier | TSESTree.JSXIdentifier
): boolean {
  if (!referenceParent) return false

  const initType = initNode.type

  /* why: binary/logical expressions need parens when used for member access or in binary operators */
  if (initType === 'BinaryExpression' || initType === 'LogicalExpression' || initType === 'ConditionalExpression') {
    if (
      referenceParent.type === 'MemberExpression' ||
      referenceParent.type === 'BinaryExpression' ||
      referenceParent.type === 'UnaryExpression'
    ) {
      return true
    }
  }

  /* why: arrow functions need parens when they are the callee of a call expression */
  if (initType === 'ArrowFunctionExpression') {
    if (referenceParent.type === 'CallExpression' && referenceParent.callee === refNode) {
      return true
    }
    if (
      referenceParent.type === 'MemberExpression' ||
      referenceParent.type === 'BinaryExpression' ||
      referenceParent.type === 'LogicalExpression'
    ) {
      return true
    }
  }

  /* why: object expressions need parens to avoid being parsed as blocks */
  if (initType === 'ObjectExpression') {
    if (referenceParent.type === 'MemberExpression' || referenceParent.type === 'ExpressionStatement') {
      return true
    }
  }

  return false
}

/**
 * Checks if a variable declaration is an export (named or default).
 *
 * @param node - The variable declaration node.
 * @returns True if the declaration is exported.
 */
function isExportedDeclaration(node: TSESTree.VariableDeclaration): boolean {
  const parent = node.parent
  return parent?.type === 'ExportNamedDeclaration' || parent?.type === 'ExportDefaultDeclaration'
}

/**
 * Checks if the usage is inside a loop condition or update where the value
 * might be expected to be evaluated only once.
 *
 * @param node - The AST node to check.
 * @returns True if the node is inside a loop header.
 */
function isInsideLoopHeader(node: TSESTree.Node): boolean {
  let current: TSESTree.Node | undefined = node.parent
  while (current) {
    if (current.type === 'ForStatement') {
      const forStmt = current
      if (isDescendantOf(node, forStmt.test) || isDescendantOf(node, forStmt.update)) {
        return true
      }
    }
    if (current.type === 'WhileStatement' || current.type === 'DoWhileStatement') {
      const whileStmt = current
      if (node === whileStmt.test || isDescendantOf(node, whileStmt.test)) {
        return true
      }
    }
    current = current.parent
  }
  return false
}

/**
 * Checks if the reference is inside an export specifier (e.g., export { value }).
 *
 * @param node - The AST node to check.
 * @returns True if the node is inside an ExportSpecifier.
 */
function isInsideExportSpecifier(node: TSESTree.Node): boolean {
  let current: TSESTree.Node | undefined = node.parent
  while (current) {
    if (current.type === 'ExportSpecifier') {
      return true
    }
    current = current.parent
  }
  return false
}

/**
 * Checks if the reference is the object of a member expression that is being assigned to.
 * e.g., obj.x = 2 - obj is being used to mutate, not recommended for inlining.
 *
 * @param node - The identifier node to check.
 * @returns True if the identifier is the object of an assigned member expression.
 */
function isObjectOfAssignedMemberExpression(node: TSESTree.Identifier | TSESTree.JSXIdentifier): boolean {
  const parent = node.parent
  if (parent?.type !== 'MemberExpression') return false
  if (parent.object !== node) return false

  const grandparent = parent.parent
  if (grandparent?.type === 'AssignmentExpression' && grandparent.left === parent) {
    return true
  }
  return false
}

/**
 * Checks if a node is a descendant of another node.
 *
 * @param node - The potential descendant node.
 * @param ancestor - The potential ancestor node.
 * @returns True if node is a descendant of ancestor.
 */
function isDescendantOf(node: TSESTree.Node, ancestor: TSESTree.Node | null | undefined): boolean {
  if (!ancestor) return false
  let current: TSESTree.Node | undefined = node.parent
  while (current) {
    if (current === ancestor) return true
    current = current.parent
  }
  return false
}

/**
 * Checks if the initializer contains a reference to the variable itself.
 *
 * @param init - The initializer expression.
 * @param varName - The variable name to look for.
 * @returns True if the initializer references the variable.
 */
function hasSelfReference(init: TSESTree.Expression, varName: string): boolean {
  if (init.type === 'Identifier' && init.name === varName) {
    return true
  }

  const children = getChildNodes(init)
  return children.some((child) => hasSelfReference(child as TSESTree.Expression, varName))
}

/**
 * Gets all child nodes of an AST node.
 *
 * @param node - The AST node.
 * @returns Array of child nodes.
 */
function getChildNodes(node: TSESTree.Node): TSESTree.Node[] {
  const children: TSESTree.Node[] = []
  for (const key of keys(node as unknown as Record<string, unknown>)) {
    if (key === 'parent' || key === 'range' || key === 'loc' || key === 'type') continue
    const value = (node as unknown as Record<string, unknown>)[key]
    if (isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object' && 'type' in item) {
          children.push(item as TSESTree.Node)
        }
      }
    } else if (value && typeof value === 'object' && 'type' in value) {
      children.push(value as TSESTree.Node)
    }
  }
  return children
}

export default createRule<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer inlining const variables that are only used once',
    },
    fixable: 'code',
    schema: [],
    messages: {
      preferInline: "Const '{{ name }}' is only used once. Inline the value instead of using a variable.",
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode

    return {
      VariableDeclaration(node) {
        if (node.kind !== 'const') return
        if (isExportedDeclaration(node)) return
        if (node.declarations.length !== 1) return

        const declarator = node.declarations[0]
        /* istanbul ignore next - defensive */
        if (!declarator) return

        if (declarator.id.type !== 'Identifier') return
        if (!declarator.init) return
        if (!isSafeToInline(declarator.init)) return

        const varName = declarator.id.name

        if (hasSelfReference(declarator.init, varName)) return

        const scope = sourceCode.getScope(node)
        const variable = scope.set.get(varName)

        if (!variable) return

        const references = variable.references.filter((ref) => !ref.init)

        if (references.length !== 1) return

        const singleRef = references[0]
        /* istanbul ignore next - defensive */
        if (!singleRef) return

        if (isInsideLoopHeader(singleRef.identifier)) return
        if (isInsideExportSpecifier(singleRef.identifier)) return
        if (singleRef.isWrite()) return
        if (isObjectOfAssignedMemberExpression(singleRef.identifier)) return

        const initText = sourceCode.getText(declarator.init)
        const refNode = singleRef.identifier
        const refParent = refNode.parent

        const wrapInParens = needsParentheses(declarator.init, refParent, refNode)
        const replacementText = wrapInParens ? `(${initText})` : initText

        context.report({
          node: declarator,
          messageId: 'preferInline',
          data: { name: varName },
          fix(fixer) {
            const fixes = []

            fixes.push(fixer.replaceText(refNode, replacementText))

            /* why: find start of line to remove leading whitespace */
            let startRange = node.range[0]
            const textBefore = sourceCode.text.slice(0, node.range[0])
            const lastNewline = textBefore.lastIndexOf('\n')
            if (lastNewline !== -1) {
              const lineStart = lastNewline + 1
              const leadingText = textBefore.slice(lineStart)
              /* why: only remove leading whitespace if line contains only the declaration */
              if (leadingText.trim() === '') {
                startRange = lineStart
              }
            }

            const tokenAfter = sourceCode.getTokenAfter(node)
            let endRange = node.range[1]

            /* why: include trailing newline in removal for clean output */
            const textBetween = tokenAfter ? sourceCode.text.slice(node.range[1], tokenAfter.range[0]) : ''
            if (textBetween.startsWith('\n')) {
              endRange = node.range[1] + 1
            } else if (textBetween.startsWith('\r\n')) {
              endRange = node.range[1] + 2
            }

            fixes.push(fixer.removeRange([startRange, endRange]))

            return fixes
          },
        })
      },
    }
  },
})
