import type { JsonTreeNode } from '../languages/json.ts'
import { defineRule } from '../engine/rule.ts'
import { testRule } from './rule-tester.ts'

/** Reports every `true`, replacing it with `false`. */
const NO_TRUE = defineRule<undefined, JsonTreeNode>({
  id: 'test/no-true',
  language: 'json',
  fixable: true,
  create: (context) => ({
    boolean(node) {
      if (node.kind === 'boolean' && node.value === true) {
        context.report({ start: node.start, end: node.end, message: 'No true', fix: { start: node.start, end: node.end, text: 'false' } })
      }
    },
  }),
})

testRule(NO_TRUE, {
  valid: [{ name: 'a document without true', path: '/w/a.json', text: '[false, 1]' }],
  invalid: [
    {
      name: 'a true with its position',
      path: '/w/a.json',
      text: '[1,\n true]',
      errors: [{ message: 'No true', line: 2, column: 2, endLine: 2, endColumn: 6 }],
    },
    {
      name: 'a true and its fix',
      path: '/w/a.json',
      text: '[true]',
      errors: [{ message: 'No true', line: 1, column: 2 }],
      output: '[false]',
    },
  ],
})
