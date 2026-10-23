import { testRule } from '../../testing/rule-tester'
import rule from './triple-slash-reference'

// why: the rule is fixed to the workspace's options; the cases recorded with other settings per reference kind are left out.
testRule(rule, {
  valid: [
    {
      name: '#19 a types reference beside an import alias of a namespace',
      path: '/root/file.ts',
      text: '/// <reference types="foo" />\nimport foo = foo;',
    },
    { name: '#24 an ordinary line comment', path: '/root/file.ts', text: '// a comment\nimport foo from "foo";' },
  ],
  invalid: [
    {
      name: '#27 /// <reference types="foo" />',
      path: '/root/file.ts',
      text: '\n/// <reference types="foo" />\nimport foo = require(\'foo\');\n      ',
      options: { types: 'prefer-import' },
      errors: [
        {
          message: 'Do not use a triple slash reference for foo, use `import` style instead.',
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 30,
        },
      ],
    },
    {
      name: '#31 a path reference under the workspace defaults, with the module in the data and the comment as the range',
      path: '/root/file.ts',
      text: '/// <reference path="./globals.d.ts" />\nexport {};',
      errors: [
        {
          message: 'Do not use a triple slash reference for ./globals.d.ts, use `import` style instead.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 40,
        },
      ],
    },
    {
      name: '#32 a types reference matched by an import under the workspace defaults',
      path: '/root/file.ts',
      text: '/// <reference types="node" />\nimport * as node from "node";',
      errors: [
        {
          message: 'Do not use a triple slash reference for node, use `import` style instead.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 31,
        },
      ],
    },
    {
      name: '#34 a types reference is reported once per matching import',
      path: '/root/file.ts',
      text: '/// <reference types="foo" />\nimport a from "foo";\nimport b from "foo";',
      errors: [
        {
          message: 'Do not use a triple slash reference for foo, use `import` style instead.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 30,
        },
        {
          message: 'Do not use a triple slash reference for foo, use `import` style instead.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 30,
        },
      ],
    },
    {
      name: '#35 only the matching one of several types references',
      path: '/root/file.ts',
      text: '/// <reference types="foo" />\n/// <reference types="bar" />\nimport bar = require("bar");',
      errors: [
        {
          message: 'Do not use a triple slash reference for bar, use `import` style instead.',
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 30,
        },
      ],
    },
    {
      name: '#36 a type-only import matches too',
      path: '/root/file.ts',
      text: '/// <reference types="foo" />\nimport type { Foo } from "foo";',
      errors: [
        {
          message: 'Do not use a triple slash reference for foo, use `import` style instead.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 30,
        },
      ],
    },
    {
      name: '#38 spacing around the attribute is tolerated',
      path: '/root/file.ts',
      text: '/// <reference   path = "a" />',
      errors: [
        {
          message: 'Do not use a triple slash reference for a, use `import` style instead.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 31,
        },
      ],
    },
  ],
})

testRule(rule, {
  valid: [
    {
      name: 'a reference inside a block comment is not a directive',
      path: '/project/file.ts',
      text: '/*\n/// <reference path="foo" />\n*/\nexport {};',
    },
  ],
  invalid: [],
})
