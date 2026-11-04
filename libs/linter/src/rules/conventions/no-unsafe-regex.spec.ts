import { testRule } from '../../testing/rule-tester'
import rule from './no-unsafe-regex'

/**
 * The report of a repetition that takes quadratic time.
 *
 * @param repetition - The repetition as the pattern writes it
 * @returns The message
 */
const quadratic = (repetition: string): string =>
  'Regex repetition `' +
  repetition +
  '` can take quadratic time (ReDoS): nothing anchors the pattern at its start, so after a failed match it is retried from every position of a long run. Anchor the pattern with `^`, have what precedes the repetition exclude the characters it repeats, or scan the string without a regex.'

// why: the workspace runs the rule with its defaults; the cases recorded with other options are left out.
testRule(rule, {
  valid: [
    { name: 'a trailing-space trim anchored at its start', path: '/root/file.ts', text: 'const pattern = /^\\s+$/' },
    { name: 'a sticky RegExp, whose flags argument anchors it', path: '/root/file.ts', text: "const pattern = new RegExp('\\\\s+$', 'y')" },
    { name: 'a comma before trailing space, which the space does not repeat', path: '/root/file.ts', text: 'const pattern = /,\\s*$/' },
    { name: '#4 simple letter pattern (case insensitive)', path: '/root/file.ts', text: 'const pattern = /[a-z]+/i' },
    { name: '#7 anchored bounded length check', path: '/root/file.ts', text: 'const pattern = /^.{1,100}$/' },
    { name: '#9 distinct word alternation', path: '/root/file.ts', text: 'const pattern = /cat|dog/' },
    { name: '#16 non-capturing group for protocol', path: '/root/file.ts', text: 'const pattern = /(?:https?):\\/\\//' },
    { name: '#23 createRegExp with string and flags', path: '/root/file.ts', text: "const pattern = createRegExp('\\\\d+', 'g')" },
    { name: '#25 RegExp with simple template literal', path: '/root/file.ts', text: 'const pattern = new RegExp(`^\\\\d+$`)' },
  ],
  invalid: [
    {
      name: 'a trailing-space trim with no start anchor',
      path: '/root/file.ts',
      text: 'const pattern = /\\s+$/',
      errors: [{ message: quadratic('\\s+'), line: 1, column: 17, endLine: 1, endColumn: 23 }],
    },
    {
      name: 'a constant RegExp pattern whose flags argument is computed',
      path: '/root/file.ts',
      text: "const pattern = createRegExp('0+$', flags)",
      errors: [{ message: quadratic('0+'), line: 1, column: 17, endLine: 1, endColumn: 43 }],
    },
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
