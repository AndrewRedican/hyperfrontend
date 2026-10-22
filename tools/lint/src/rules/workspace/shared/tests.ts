/**
 * Which calls declare a test or a suite, as the test runners spell them: `it`, `test`, `fit`,
 * `xit` and `xtest` for tests, `describe`, `fdescribe` and `xdescribe` for suites, each with
 * the focus, skip, pending, failing and concurrent modifiers, and the table forms
 * `it.each(table)(...)` and it.each`table`(...).
 *
 * @module rules/workspace/shared/tests
 */

import type { Node } from '../../../code/model.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** The names that declare a test. */
export const TEST_NAMES: ReadonlySet<string> = createSet<string>(['it', 'test', 'fit', 'xit', 'xtest'])

/** The names that declare a suite. */
export const SUITE_NAMES: ReadonlySet<string> = createSet<string>(['describe', 'fdescribe', 'xdescribe'])

/** The modifiers a declaration may chain after its name. */
const MODIFIERS = createSet<string>(['only', 'skip', 'todo', 'failing', 'concurrent'])

/**
 * The names along a chain of plain member accesses, from the root identifier outward.
 *
 * @param node - The expression read
 * @returns The names, or null when the chain holds anything but identifiers and dot accesses
 */
function chainOf(node: Node): string[] | null {
  if (node.kind === 'Identifier') return [node.name as string]
  if (node.kind !== 'MemberExpression' || node.computed === true) return null
  const names = chainOf(node.object as Node)
  if (names === null) return null
  names.push((node.property as Node).name as string)
  return names
}

/**
 * Whether a chain is one of the given names followed by modifiers only.
 *
 * @param chain - The names along the callee
 * @param names - The names that declare
 * @returns Whether the chain declares
 */
function isDeclaration(chain: readonly string[], names: ReadonlySet<string>): boolean {
  return names.has(chain[0] as string) && chain.slice(1).every((modifier) => MODIFIERS.has(modifier))
}

/**
 * The callee of a call that declares with one of the given names: the name or modifier chain,
 * or for a table form the `each` call or tagged template that produced the declaring function.
 *
 * @param call - The call expression examined
 * @param names - The names that declare
 * @returns The callee to report on, or null when the call declares nothing
 */
export function declarationOf(call: Node, names: ReadonlySet<string>): Node | null {
  const callee = call.callee as Node
  if (callee.kind === 'CallExpression' || callee.kind === 'TaggedTemplateExpression') {
    const chain = chainOf((callee.kind === 'CallExpression' ? callee.callee : callee.tag) as Node)
    if (chain === null || chain.length < 2 || chain[chain.length - 1] !== 'each') return null
    return isDeclaration(chain.slice(0, -1), names) ? callee : null
  }
  const chain = chainOf(callee)
  return chain !== null && isDeclaration(chain, names) ? callee : null
}

/**
 * The callee of a call that declares a test.
 *
 * @param call - The call expression examined
 * @returns The callee to report on, or null
 */
export function testDeclaration(call: Node): Node | null {
  return declarationOf(call, TEST_NAMES)
}

/**
 * The callee of a call that declares a suite.
 *
 * @param call - The call expression examined
 * @returns The callee to report on, or null
 */
export function suiteDeclaration(call: Node): Node | null {
  return declarationOf(call, SUITE_NAMES)
}
