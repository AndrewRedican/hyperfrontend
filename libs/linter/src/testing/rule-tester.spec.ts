import type { JsonTreeNode } from '../languages/json'
import { describe, expect, it } from '@hyperfrontend/testing'
import { defineRule } from '../engine/rule'
import { expectedErrors, testRule } from './rule-tester'

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

describe('expectedErrors', () => {
  it('takes an omitted end from the reported error', () => {
    expect(
      expectedErrors([{ message: 'm', line: 1, column: 1 }], [{ message: 'm', line: 1, column: 1, endLine: 1, endColumn: 4 }])
    ).toEqual([{ message: 'm', line: 1, column: 1, endLine: 1, endColumn: 4 }])
  })

  it('matches no missing end with an omitted one', () => {
    expect(
      expectedErrors([{ message: 'm', line: 1, column: 1 }], [{ message: 'm', line: 1, column: 1, endLine: null, endColumn: null }])
    ).toEqual([{ message: 'm', line: 1, column: 1, endLine: -1, endColumn: -1 }])
  })

  it('matches no error the rule did not report', () => {
    expect(expectedErrors([{ message: 'm', line: 1, column: 1 }], [])).toEqual([
      { message: 'm', line: 1, column: 1, endLine: -1, endColumn: -1 },
    ])
  })

  it('keeps an end the spec gave', () => {
    expect(expectedErrors([{ message: 'm', line: 1, column: 1, endLine: 2, endColumn: 3 }], [])).toEqual([
      { message: 'm', line: 1, column: 1, endLine: 2, endColumn: 3 },
    ])
  })
})
