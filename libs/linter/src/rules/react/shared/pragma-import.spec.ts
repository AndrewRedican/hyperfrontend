import type { Node } from '../../../code/model'
import type { InvalidCase, RuleCase } from '../../../testing/rule-tester'
import { defineRule } from '../../../engine/rule'
import { testRule } from '../../../testing/rule-tester'
import { isFromPragma } from './pragma-import'

/** Reports each call whose callee name comes from `React`. */
const probe = defineRule<undefined, Node>({
  id: 'react/probe-pragma-import',
  language: 'code',
  fixable: false,
  create: (context) => ({
    CallExpression(node) {
      if (isFromPragma(context, node, (node.callee as Node).name as string, 'React')) {
        context.report({ start: node.start, end: node.end, message: 'from pragma' })
      }
    },
  }),
})

/**
 * A case linted as a TSX file.
 *
 * @param name - The test's name
 * @param text - The text linted
 * @returns The case
 */
function tsx(name: string, text: string): RuleCase {
  return { name, path: '/root/file.tsx', text }
}

/**
 * A case reporting its last line's call.
 *
 * @param name - The test's name
 * @param text - The text linted, ending in a call on its second line
 * @returns The case with its one error
 */
function reported(name: string, text: string): InvalidCase {
  return { ...tsx(name, text), errors: [{ message: 'from pragma', line: 2, column: 1 }] }
}

testRule(probe, {
  valid: [
    tsx('an undeclared name', 'createElement()'),
    { ...tsx('a global without a definition', 'createElement()'), language: { globals: { createElement: 'readonly' } } },
    tsx('a declarator without an initialiser', 'let createElement\ncreateElement()'),
    tsx('destructuring another object', 'const { createElement } = Other\ncreateElement()'),
    tsx('a member of another object', 'const createElement = Other.createElement\ncreateElement()'),
    tsx('a member of another call', 'const createElement = load().createElement\ncreateElement()'),
    tsx('a member of this', 'const createElement = this.createElement\ncreateElement()'),
    tsx('a require without arguments', 'const { createElement } = require()\ncreateElement()'),
    tsx('a require of another module', "const { createElement } = require('preact')\ncreateElement()"),
    tsx('a literal', 'const createElement = 1\ncreateElement()'),
    tsx('an import from another module', "import { createElement } from 'preact'\ncreateElement()"),
    tsx('a function declaration', 'function createElement() {}\ncreateElement()'),
  ],
  invalid: [
    reported('destructuring the pragma', 'const { createElement } = React\ncreateElement()'),
    reported('a member of the pragma', 'const createElement = React.createElement\ncreateElement()'),
    reported('a member of the require', "const createElement = require('react').createElement\ncreateElement()"),
    reported('destructuring the require', "const { createElement } = require('react')\ncreateElement()"),
    reported('an import from the module', "import { createElement } from 'react'\ncreateElement()"),
  ],
})
