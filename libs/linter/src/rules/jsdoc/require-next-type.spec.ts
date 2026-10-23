import { testRule } from '../../testing/rule-tester'
import rule from './require-next-type'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    { name: '#1 /**', path: '/root/file.ts', text: '\n        /**\n         * @next {SomeType}\n         */\n      ' },
    {
      name: '#2 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Yields numbers.\n *\n * @next {number} The value sent back in\n */\nexport function* counter() {}\n',
    },
  ],
  invalid: [
    {
      name: '#6 /** @next */',
      path: '/root/file.ts',
      text: '\n/** @next */\nconst value = 1\n',
      errors: [{ message: '@next should have a type', line: 2, column: 1, endLine: 2, endColumn: 13 }],
    },
    {
      name: '#7 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @next {number}\n * @next\n */\nfunction* quux () {}\n',
      errors: [{ message: '@next should have a type', line: 2, column: 1, endLine: 5, endColumn: 4 }],
    },
  ],
})
