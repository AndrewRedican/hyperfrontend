import type { Node } from '../../../code/model'
import { defineRule } from '../../../engine/rule'
import { testRule } from '../../../testing/rule-tester'
import { fileBlocks } from './blocks'
import { checkPathRoots } from './tag-paths'

/** A rule checking the roots of every `@arg` path. */
const rule = defineRule<undefined, Node>({
  id: 'jsdoc/tag-paths-probe',
  language: 'code',
  fixable: false,
  create: (context) => ({
    Program() {
      for (const { block } of fileBlocks(context)) {
        checkPathRoots(
          context,
          block.tags.filter((tag) => tag.tag === 'arg'),
          'arg',
          'argument'
        )
      }
    },
  }),
})

testRule(rule, {
  valid: [{ name: 'paths under their roots', path: '/root/file.ts', text: '/**\n * @arg a\n * @arg a.b\n * @arg c\n * @arg c[].d\n */' }],
  invalid: [
    {
      name: 'a path first',
      path: '/root/file.ts',
      text: '/**\n * @arg a.b\n */',
      errors: [
        { message: '@arg path declaration ("a.b") appears before any real argument.', line: 2, column: 1, endLine: 2, endColumn: 1 },
      ],
    },
    {
      name: 'a path under another root',
      path: '/root/file.ts',
      text: '/**\n * @arg a\n * @arg b.c\n */',
      errors: [
        {
          message: '@arg path declaration ("b.c") root node name ("b") does not match previous real argument name ("a").',
          line: 3,
          column: 1,
          endLine: 3,
          endColumn: 1,
        },
      ],
    },
  ],
})
