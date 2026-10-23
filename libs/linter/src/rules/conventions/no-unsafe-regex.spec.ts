import { testRule } from '../../testing/rule-tester'
import rule from './no-unsafe-regex'

// why: the workspace runs the rule with its defaults; the cases recorded with other options are left out.
testRule(rule, {
  valid: [
    { name: '#4 simple letter pattern (case insensitive)', path: '/root/file.ts', text: 'const pattern = /[a-z]+/i' },
    { name: '#7 anchored bounded length check', path: '/root/file.ts', text: 'const pattern = /^.{1,100}$/' },
    { name: '#9 distinct word alternation', path: '/root/file.ts', text: 'const pattern = /cat|dog/' },
    { name: '#16 non-capturing group for protocol', path: '/root/file.ts', text: 'const pattern = /(?:https?):\\/\\//' },
    { name: '#23 createRegExp with string and flags', path: '/root/file.ts', text: "const pattern = createRegExp('\\\\d+', 'g')" },
    { name: '#25 RegExp with simple template literal', path: '/root/file.ts', text: 'const pattern = new RegExp(`^\\\\d+$`)' },
  ],
  invalid: [
    {
      name: '#40 exponential bounds a{1,100000}',
      path: '/root/file.ts',
      text: 'const pattern = /a{1,100000}/',
      errors: [
        {
          message: 'Quantifier bound `{1,100000}` exceeds safe threshold (1000). Use smaller bounds or process input in chunks.',
          line: 1,
          column: 17,
          endLine: 1,
          endColumn: 30,
        },
      ],
    },
    {
      name: '#43 CVE-2020-7660: serialize-javascript pattern',
      path: '/root/file.ts',
      text: 'const pattern = /(([^\\s]+)+)+/',
      errors: [
        {
          message:
            'Regex pattern may cause catastrophic backtracking (ReDoS). Refactor to use non-nested quantifiers, avoid overlapping alternations, or use atomic groups.',
          line: 1,
          column: 17,
          endLine: 1,
          endColumn: 31,
        },
      ],
    },
    {
      name: '#47 new RegExp with concatenation',
      path: '/root/file.ts',
      text: "const pattern = new RegExp(prefix + '.*')",
      errors: [
        {
          message:
            'RegExp constructed from non-literal value may be vulnerable to ReDoS if input is untrusted. Validate and sanitize input, or use a safe-regex library.',
          line: 1,
          column: 17,
          endLine: 1,
          endColumn: 42,
        },
      ],
    },
    {
      name: '#50 createRegExp with schema.pattern (variable)',
      path: '/root/file.ts',
      text: 'const pattern = createRegExp(schema.pattern)',
      errors: [
        {
          message:
            'createRegExp() called with non-literal value may be vulnerable to ReDoS if input is untrusted. Validate and sanitize input before constructing the regex pattern.',
          line: 1,
          column: 17,
          endLine: 1,
          endColumn: 45,
        },
      ],
    },
    {
      name: '#54 createRegExp with template literal interpolation',
      path: '/root/file.ts',
      text: 'const pattern = createRegExp(`${prefix}.*`)',
      errors: [
        {
          message: 'Template literal in RegExp may inject unsafe patterns. Escape special regex characters or use literal patterns.',
          line: 1,
          column: 17,
          endLine: 1,
          endColumn: 44,
        },
      ],
    },
  ],
})

// why: the cases recorded from the previous linter leave constructors without arguments and other callees unexercised.
testRule(rule, {
  valid: [
    { name: 'a constructor without arguments', path: '/root/file.ts', text: 'new RegExp()' },
    { name: 'another constructor', path: '/root/file.ts', text: 'new Other(x)' },
    { name: 'another function', path: '/root/file.ts', text: 'other(x)' },
    { name: 'a member constructor', path: '/root/file.ts', text: 'new globalThis.RegExp(x)' },
  ],
  invalid: [],
})
