import type { Node } from '../../../code/model'
import { defineRule } from '../../../engine/rule'
import { testRule } from '../../../testing/rule-tester'
import { documentedNodes } from './functions'
import { reportBlock, reportLineNumber, reportTag } from './report'

/** A rule reporting every documented function's block, and its first tag's line with a fix. */
const rule = defineRule<undefined, Node>({
  id: 'jsdoc/report-probe',
  language: 'code',
  fixable: true,
  create: (context) =>
    documentedNodes(context, (_node, block) => {
      reportBlock(context, block, 'block')
      reportLineNumber(context, 1, 'line')
      const tag = block.tags[0]
      if (tag !== undefined) reportTag(context, tag, 'tag', { start: tag.lines[0].offset, end: tag.lines[0].offset, text: '' })
    }),
})

testRule(rule, {
  valid: [{ name: 'an undocumented function', path: '/root/file.ts', text: 'function f() {}' }],
  invalid: [
    {
      name: 'a block and its tag line',
      path: '/root/file.ts',
      text: '/**\n * @param a - A\n */\nfunction f(a) {}',
      errors: [
        { message: 'block', line: 1, column: 1, endLine: 3, endColumn: 4 },
        { message: 'line', line: 1, column: 1, endLine: 1, endColumn: 1 },
        { message: 'tag', line: 2, column: 1, endLine: 2, endColumn: 1 },
      ],
      output: '/**\n * @param a - A\n */\nfunction f(a) {}',
    },
  ],
})
