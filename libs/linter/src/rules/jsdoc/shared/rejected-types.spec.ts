import type { Node } from '../../../code/model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { defineRule } from '../../../engine/rule'
import { testRule } from '../../../testing/rule-tester'
import { rejectedTypeListeners } from './rejected-types'

/** A rule rejecting `*` and `Bad`. */
const rule = defineRule<undefined, Node>({
  id: 'jsdoc/rejected-types-probe',
  language: 'code',
  fixable: false,
  create: (context) =>
    rejectedTypeListeners(
      context,
      createMap([
        ['*', 'star'],
        ['Bad', 'bad'],
      ])
    ),
})

testRule(rule, {
  valid: [{ name: 'other names and a path member', path: '/root/file.ts', text: '/** @type {Good|A.Bad} */' }],
  invalid: [
    {
      name: 'the any type and a rejected name',
      path: '/root/file.ts',
      text: '/** @type {Array<*>|Bad} */',
      errors: [
        { message: 'star', line: 1, column: 1, endLine: 1, endColumn: 1 },
        { message: 'bad', line: 1, column: 1, endLine: 1, endColumn: 1 },
      ],
    },
  ],
})
