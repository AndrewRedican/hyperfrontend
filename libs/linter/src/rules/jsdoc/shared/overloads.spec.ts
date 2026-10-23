import type { Node } from '../../../code/model'
import type { RuleCase } from '../../../testing/rule-tester'
import { defineRule } from '../../../engine/rule'
import { testRule } from '../../../testing/rule-tester'
import { jsdocWithOverloads } from './overloads'

/** A rule reporting every function declaration no block documents, overloads looked through. */
const rule = defineRule<undefined, Node>({
  id: 'jsdoc/overloads-probe',
  language: 'code',
  fixable: false,
  create: (context) => ({
    FunctionDeclaration(node) {
      if (jsdocWithOverloads(context, node) === null) context.report({ start: node.start, end: node.start + 8, message: 'undocumented' })
    },
  }),
})

/**
 * A case whose function declaration is documented through its overloads.
 *
 * @param name - What it exercises
 * @param text - The code
 * @returns The case
 */
function valid(name: string, text: string): RuleCase {
  return { name, path: '/root/file.ts', text }
}

/** The report on a function declaration at the start of line 2. */
const SECOND_LINE = [{ message: 'undocumented', line: 2, column: 1, endLine: 2, endColumn: 9 }]

testRule(rule, {
  valid: [
    valid(
      'an implementation after two overloads',
      '/** A */\nfunction f(a: string): void\n/** B */\nfunction f(): void\nfunction f(a?) {}'
    ),
    valid('an exported implementation after an exported overload', '/** A */\nexport function f(a: string): void\nexport function f(a) {}'),
    valid(
      'an exported implementation after two exported overloads',
      '/** A */\nexport function f(a: string): void\nexport function f(a: number): void\nexport function f(a) {}'
    ),
  ],
  invalid: [
    { name: 'a first statement', path: '/root/file.ts', text: '\nfunction f() {}', errors: SECOND_LINE },
    {
      name: 'a function after another implementation',
      path: '/root/file.ts',
      text: '/** A */ function f() {}\nfunction f() {}',
      errors: SECOND_LINE,
    },
    {
      name: 'a function after another name',
      path: '/root/file.ts',
      text: '/** A */ declare function g()\nfunction f() {}',
      errors: SECOND_LINE,
    },
    { name: 'a function after another statement', path: '/root/file.ts', text: 'let a\nfunction f() {}', errors: SECOND_LINE },
    {
      name: 'a nested function',
      path: '/root/file.ts',
      text: '{\nfunction f() {}\n}',
      errors: SECOND_LINE,
    },
    {
      name: 'an export of something else',
      path: '/root/file.ts',
      text: '/** A */ export const a = 1\nfunction f() {}',
      errors: SECOND_LINE,
    },
  ],
})
