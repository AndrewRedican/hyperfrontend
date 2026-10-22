import type { Node } from '../../../code/model.ts'
import { defineRule } from '../../../engine/rule.ts'
import { testRule } from '../../../testing/rule-tester.ts'
import { untypedTagListeners } from './typed-tags.ts'

/** A rule requiring a type on `@a` and `@b`. */
const rule = defineRule<undefined, Node>({
  id: 'jsdoc/typed-tags-probe',
  language: 'code',
  fixable: false,
  create: (context) => untypedTagListeners(context, ['a', 'b'], 'untyped'),
})

testRule(rule, {
  valid: [{ name: 'typed tags and others', path: '/root/file.ts', text: '/**\n * @a {x}\n * @c\n */' }],
  invalid: [
    {
      name: 'two untyped tags in one block',
      path: '/root/file.ts',
      text: '/**\n * @a\n * @b\n */',
      errors: [{ message: 'untyped', line: 1, column: 1, endLine: 4, endColumn: 4 }],
    },
  ],
})
