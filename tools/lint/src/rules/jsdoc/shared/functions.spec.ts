import type { Node } from '../../../code/model.ts'
import { defineRule } from '../../../engine/rule.ts'
import { testRule } from '../../../testing/rule-tester.ts'
import { documentedNodes } from './functions.ts'

/** A rule reporting the kind of every documented class. */
const rule = defineRule<undefined, Node>({
  id: 'jsdoc/functions-probe',
  language: 'code',
  fixable: false,
  create: (context) =>
    documentedNodes(context, (node) => context.report({ start: node.start, end: node.end, message: node.kind }), ['ClassDeclaration']),
})

testRule(rule, {
  valid: [{ name: 'an undocumented class', path: '/root/file.ts', text: 'class A {}' }],
  invalid: [
    {
      name: 'a documented class',
      path: '/root/file.ts',
      text: '/** A */\nclass A {}',
      errors: [{ message: 'ClassDeclaration', line: 2, column: 1, endLine: 2, endColumn: 11 }],
    },
  ],
})
