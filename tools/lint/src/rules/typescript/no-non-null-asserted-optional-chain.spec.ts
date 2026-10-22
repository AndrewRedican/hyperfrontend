import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-non-null-asserted-optional-chain.ts'

testRule(rule, {
  valid: [
    { name: '#1 foo.bar!;', path: '/root/file.ts', text: 'foo.bar!;' },
    { name: '#15 an assertion inside the arguments of an optional call', path: '/root/file.ts', text: 'foo?.bar(baz!);' },
  ],
  invalid: [
    {
      name: '#23 (foo?.bar)!().baz',
      path: '/root/file.ts',
      text: '(foo?.bar)!().baz',
      errors: [
        {
          message: 'Optional chain expressions can return undefined by design - using a non-null assertion is unsafe and wrong.',
          line: 1,
          column: 2,
          endLine: 1,
          endColumn: 10,
        },
      ],
    },
    {
      name: '#28 the range of an assertion at the end of a chain covers the chain and the bang',
      path: '/root/file.ts',
      text: 'const a = foo?.bar!;',
      errors: [
        {
          message: 'Optional chain expressions can return undefined by design - using a non-null assertion is unsafe and wrong.',
          line: 1,
          column: 11,
          endLine: 1,
          endColumn: 20,
        },
      ],
    },
    {
      name: '#30 a multi-line chain ending in an assertion',
      path: '/root/file.ts',
      text: 'foo\n  ?.bar\n  ?.baz!;',
      errors: [
        {
          message: 'Optional chain expressions can return undefined by design - using a non-null assertion is unsafe and wrong.',
          line: 1,
          column: 1,
          endLine: 3,
          endColumn: 9,
        },
      ],
    },
    {
      name: '#33 two asserted chains in one statement',
      path: '/root/file.ts',
      text: 'foo?.a! + (bar?.b)!;',
      errors: [
        {
          message: 'Optional chain expressions can return undefined by design - using a non-null assertion is unsafe and wrong.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 8,
        },
        {
          message: 'Optional chain expressions can return undefined by design - using a non-null assertion is unsafe and wrong.',
          line: 1,
          column: 12,
          endLine: 1,
          endColumn: 18,
        },
      ],
    },
    {
      name: '#34 an optional computed call ending in an assertion',
      path: '/root/file.ts',
      text: "foo?.['bar']?.()!;",
      errors: [
        {
          message: 'Optional chain expressions can return undefined by design - using a non-null assertion is unsafe and wrong.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 18,
        },
      ],
    },
  ],
})
