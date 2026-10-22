import type { Node } from '../../../code/model.ts'
import { defineRule } from '../../../engine/rule.ts'
import { testRule } from '../../../testing/rule-tester.ts'
import { fileBlocks } from './blocks.ts'

/** A rule reporting every block with the kind of the node it documents, reading the blocks twice. */
const rule = defineRule<undefined, Node>({
  id: 'jsdoc/blocks-probe',
  language: 'code',
  fixable: false,
  create: (context) => ({
    Program() {
      fileBlocks(context)
      for (const { block, node } of fileBlocks(context)) {
        context.report({ start: block.start, end: block.end, message: node === null ? 'none' : node.kind })
      }
    },
  }),
})

testRule(rule, {
  valid: [
    { name: 'no comments', path: '/root/file.ts', text: 'const a = 1' },
    { name: 'comments that are no blocks', path: '/root/file.ts', text: '// a\n/**/\n/**a */\n/* b */\nconst a = 1' },
  ],
  invalid: [
    {
      name: 'an exported function and a loose block',
      path: '/root/file.ts',
      text: '/** A */\nexport function f() {}\n\n/** B */\n',
      errors: [
        { message: 'ExportNamedDeclaration', line: 1, column: 1, endLine: 1, endColumn: 9 },
        { message: 'none', line: 4, column: 1, endLine: 4, endColumn: 9 },
      ],
    },
  ],
})
