/**
 * Recognition of the test and suite declarations a spec file is built from, shared by the
 * rules that inspect test bodies and titles.
 *
 * @module utils/test-declarations
 */

import type { TSESTree } from '@typescript-eslint/utils'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Function names that declare a single test (`it` and `test` variants, never `describe`).
 */
export const TEST_FUNCTION_NAMES = createSet(['it', 'test', 'fit', 'xit', 'xtest'])

/**
 * Modifier properties that keep a member call within the test-function family (`it.only`, `test.each`).
 */
export const TEST_MODIFIER_NAMES = createSet(['only', 'skip', 'todo', 'failing', 'concurrent', 'each'])

/**
 * Function names that declare a suite of tests.
 */
export const SUITE_FUNCTION_NAMES = createSet(['describe', 'fdescribe', 'xdescribe', 'suite'])

/**
 * Modifier properties that keep a member call within the suite-function family (`describe.only`, `describe.each`).
 */
export const SUITE_MODIFIER_NAMES = createSet(['only', 'skip', 'each'])

/**
 * Determines whether a callee refers to one of the named declaration functions, including modifier
 * chains such as `it.only` and table forms such as `it.each(table)(...)` and `` it.each`table`(...) ``.
 *
 * @param node - Callee expression of the call being inspected.
 * @param names - Bare function names that start a declaration.
 * @param modifiers - Member names that keep a chain within the family.
 * @returns True when the call declares one of the named constructs.
 */
function isDeclarationCallee(node: TSESTree.Node, names: ReadonlySet<string>, modifiers: ReadonlySet<string>): boolean {
  if (node.type === 'Identifier') {
    return names.has(node.name)
  }
  if (node.type === 'MemberExpression') {
    return node.property.type === 'Identifier' && modifiers.has(node.property.name) && isDeclarationCallee(node.object, names, modifiers)
  }
  if (node.type === 'CallExpression') {
    return isEachOfDeclaration(node.callee, names, modifiers)
  }
  if (node.type === 'TaggedTemplateExpression') {
    return isEachOfDeclaration(node.tag, names, modifiers)
  }
  return false
}

/**
 * Determines whether an expression is an `each` member access on a declaration chain, as produced
 * by `it.each(table)` or `` it.each`table` ``.
 *
 * @param node - Callee or tag expression to inspect.
 * @param names - Bare function names that start a declaration.
 * @param modifiers - Member names that keep a chain within the family.
 * @returns True when the expression selects `each` from a declaration function.
 */
function isEachOfDeclaration(node: TSESTree.Node, names: ReadonlySet<string>, modifiers: ReadonlySet<string>): boolean {
  return (
    node.type === 'MemberExpression' &&
    node.property.type === 'Identifier' &&
    node.property.name === 'each' &&
    isDeclarationCallee(node.object, names, modifiers)
  )
}

/**
 * Determines whether a callee declares a single test: `it`, `test`, `fit`, `xit` or `xtest`, bare or
 * through one of the modifiers in {@link TEST_MODIFIER_NAMES}, including the table forms `it.each(table)(...)`
 * and `` it.each`table`(...) ``.
 *
 * @param node - Callee expression of the call being inspected.
 * @returns True when the call declares a test.
 */
export function isTestFunctionCallee(node: TSESTree.Node): boolean {
  return isDeclarationCallee(node, TEST_FUNCTION_NAMES, TEST_MODIFIER_NAMES)
}

/**
 * Determines whether a callee declares a suite: `describe`, `fdescribe`, `xdescribe` or `suite`, with
 * or without the modifiers `only`, `skip` and `each`, including the table forms.
 *
 * @param node - Callee expression of the call being inspected.
 * @returns True when the call declares a suite.
 */
export function isSuiteFunctionCallee(node: TSESTree.Node): boolean {
  return isDeclarationCallee(node, SUITE_FUNCTION_NAMES, SUITE_MODIFIER_NAMES)
}
