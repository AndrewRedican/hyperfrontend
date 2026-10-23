import type { InvalidCase } from '../../testing/rule-tester'
import { testRule } from '../../testing/rule-tester'
import rule from './no-misleading-character-class'

// why: the workspace runs the rule without `allowEscape`, and the new linter cannot turn the `RegExp` global off; the cases recorded either way are left out.
testRule(rule, {
  valid: [
    { name: '#12 new RegExp()', path: '/root/file.ts', text: 'new RegExp()' },
    { name: '#14 const regex = /[👍]/u; new RegExp(regex);', path: '/root/file.ts', text: 'const regex = /[👍]/u; new RegExp(regex);' },
    { name: "#32 var r = RegExp('{ [Á]', 'u');", path: '/root/file.ts', text: "var r = RegExp('{ [Á]', 'u');" },
    { name: "#33 var r = new globalThis.RegExp('[Á] [ ');", path: '/root/file.ts', text: "var r = new globalThis.RegExp('[Á] [ ');" },
    { name: '#35 var r = RegExp(`${x}[👍]`)', path: '/root/file.ts', text: 'var r = RegExp(`${x}[👍]`)' },
    { name: "#36 var r = new RegExp('[🇯🇵]', `${foo}`)", path: '/root/file.ts', text: "var r = new RegExp('[🇯🇵]', `${foo}`)" },
    {
      name: "#38 const args = ['[👍]', 'i']; new RegExp(...args);",
      path: '/root/file.ts',
      text: "const args = ['[👍]', 'i']; new RegExp(...args);",
    },
    { name: '#40 var r = /^[\\q{👶🏻}]$/v', path: '/root/file.ts', text: 'var r = /^[\\q{👶🏻}]$/v' },
    { name: '#43 var r = /[🇯[A--B]🇵]/v', path: '/root/file.ts', text: 'var r = /[🇯[A--B]🇵]/v' },
    { name: '#56 a character set before the characters of a class', path: '/root/file.ts', text: 'var r = /[\\d👍]/u' },
  ],
  invalid: [
    {
      name: '#68 var r = /[\\uD83D\\uDC4D-\\uffff]/',
      path: '/root/file.ts',
      text: 'var r = /[\\uD83D\\uDC4D-\\uffff]/',
      language: { sourceType: 'script' },
      errors: [{ message: "Unexpected surrogate pair in character class. Use 'u' flag.", line: 1, column: 11, endLine: 1, endColumn: 23 }],
    },
    {
      name: '#74 var r = /[👍]\\a/',
      path: '/root/file.ts',
      text: 'var r = /[👍]\\a/',
      errors: [{ message: "Unexpected surrogate pair in character class. Use 'u' flag.", line: 1, column: 11, endLine: 1, endColumn: 13 }],
    },
    {
      name: '#76 var r = /(?<=[👍])/',
      path: '/root/file.ts',
      text: 'var r = /(?<=[👍])/',
      errors: [{ message: "Unexpected surrogate pair in character class. Use 'u' flag.", line: 1, column: 15, endLine: 1, endColumn: 17 }],
    },
    {
      name: '#89 var r = /[👶🏻]/u',
      path: '/root/file.ts',
      text: 'var r = /[👶🏻]/u',
      errors: [{ message: 'Unexpected modified Emoji in character class.', line: 1, column: 11, endLine: 1, endColumn: 15 }],
    },
    {
      name: '#95 var r = /[🇯🇵]/u',
      path: '/root/file.ts',
      text: 'var r = /[🇯🇵]/u',
      errors: [{ message: 'Unexpected national flag in character class.', line: 1, column: 11, endLine: 1, endColumn: 15 }],
    },
    {
      name: '#98 var r = /[👨‍👩‍👦]/',
      path: '/root/file.ts',
      text: 'var r = /[👨‍👩‍👦]/',
      errors: [
        { message: "Unexpected surrogate pair in character class. Use 'u' flag.", line: 1, column: 11, endLine: 1, endColumn: 13 },
        { message: 'Unexpected joined character sequence in character class.', line: 1, column: 12, endLine: 1, endColumn: 15 },
        { message: "Unexpected surrogate pair in character class. Use 'u' flag.", line: 1, column: 14, endLine: 1, endColumn: 16 },
        { message: 'Unexpected joined character sequence in character class.', line: 1, column: 15, endLine: 1, endColumn: 18 },
        { message: "Unexpected surrogate pair in character class. Use 'u' flag.", line: 1, column: 17, endLine: 1, endColumn: 19 },
      ],
    },
    {
      name: '#112 var r = new RegExp(`',
      path: '/root/file.ts',
      text: 'var r = new RegExp(`\n                [👍]`)',
      errors: [{ message: "Unexpected surrogate pair in character class. Use 'u' flag.", line: 2, column: 18, endLine: 2, endColumn: 20 }],
    },
    {
      name: '#114 var r = new RegExp(`',
      path: '/root/file.ts',
      text: 'var r = new RegExp(`\r\n[❇️]`)',
      errors: [{ message: 'Unexpected combined character in character class.', line: 2, column: 2, endLine: 2, endColumn: 4 }],
    },
    {
      name: '#123 var r = new RegExp("[👍]", "")',
      path: '/root/file.ts',
      text: 'var r = new RegExp("[👍]", "")',
      language: { sourceType: 'script' },
      errors: [{ message: "Unexpected surrogate pair in character class. Use 'u' flag.", line: 1, column: 22, endLine: 1, endColumn: 24 }],
    },
    {
      name: '#146 var r = RegExp(`\\t\\t\\t👍[👍]`)',
      path: '/root/file.ts',
      text: 'var r = RegExp(`\\t\\t\\t👍[👍]`)',
      errors: [{ message: "Unexpected surrogate pair in character class. Use 'u' flag.", line: 1, column: 26, endLine: 1, endColumn: 28 }],
    },
    {
      name: '#153 var r = new RegExp((("[🇯🇵]")))',
      path: '/root/file.ts',
      text: 'var r = new RegExp((("[🇯🇵]")))',
      errors: [
        { message: "Unexpected surrogate pair in character class. Use 'u' flag.", line: 1, column: 24, endLine: 1, endColumn: 26 },
        { message: "Unexpected surrogate pair in character class. Use 'u' flag.", line: 1, column: 26, endLine: 1, endColumn: 28 },
      ],
    },
    {
      name: '#164 var r = new RegExp("[\\\\uD83D\\\\uDC68\\\\u200D\\\\uD83D\\\\uDC69\\\\u2…',
      path: '/root/file.ts',
      text: 'var r = new RegExp("[\\\\uD83D\\\\uDC68\\\\u200D\\\\uD83D\\\\uDC69\\\\u200D\\\\uD83D\\\\uDC66]", "u")',
      errors: [{ message: 'Unexpected joined character sequence in character class.', line: 1, column: 22, endLine: 1, endColumn: 78 }],
    },
    {
      name: '#170 /[\\ud83d\\u{dc4d}]/u',
      path: '/root/file.ts',
      text: '/[\\ud83d\\u{dc4d}]/u',
      errors: [{ message: 'Unexpected surrogate pair in character class.', line: 1, column: 3, endLine: 1, endColumn: 17 }],
    },
    {
      name: '#177 RegExp(/[👍]/)',
      path: '/root/file.ts',
      text: 'RegExp(/[👍]/)',
      errors: [{ message: "Unexpected surrogate pair in character class. Use 'u' flag.", line: 1, column: 10, endLine: 1, endColumn: 12 }],
    },
    {
      name: '#180 // "[" and "]" escaped as "\\x5B" and "\\u005D"',
      path: '/root/file.ts',
      text: '\n\n            // "[" and "]" escaped as "\\x5B" and "\\u005D"\n            new RegExp("\\x5B \\\\ufe0f\\u005D")\n\n            ',
      errors: [{ message: 'Unexpected combined character in character class.', line: 4, column: 29, endLine: 4, endColumn: 37 }],
    },
    {
      name: '#181 // backslash escaped as "\\u{5c}"',
      path: '/root/file.ts',
      text: '\n\n            // backslash escaped as "\\u{5c}"\n            new RegExp("[ \\u{5c}ufe0f]")\n\n            ',
      errors: [{ message: 'Unexpected combined character in character class.', line: 4, column: 26, endLine: 4, endColumn: 38 }],
    },
    {
      name: '#183 // line continuation: backslash + <CR> + <LF>',
      path: '/root/file.ts',
      text: "\n\n            // line continuation: backslash + <CR> + <LF>\n            new RegExp('[ \\\\u\\\r\nfe0f]')\n\n            ",
      errors: [{ message: 'Unexpected combined character in character class.', line: 4, column: 26, endLine: 5, endColumn: 5 }],
    },
    {
      name: '#203 a concatenated pattern is reported as a whole',
      path: '/root/file.ts',
      text: "new RegExp('[' + '👍]')",
      errors: [{ message: "Unexpected surrogate pair in character class. Use 'u' flag.", line: 1, column: 12, endLine: 1, endColumn: 23 }],
    },
  ],
})

/** The message for a surrogate pair read without the unicode flag. */
const PAIR = "Unexpected surrogate pair in character class. Use 'u' flag."

/**
 * A pattern string whose surrogate pair follows an escape, reported at the pair's place in the source.
 *
 * @param name - What the escape exercises
 * @param argument - The source of the string argument, quotes included
 * @param at - The pair's line, column and end column in the source
 * @param script - Whether the file is a sloppy script, where legacy octal escapes parse
 * @returns The case
 */
function after(name: string, argument: string, at: readonly [number, number, number], script = false): InvalidCase {
  return {
    name,
    path: '/root/file.ts',
    text: `new RegExp(${argument})`,
    ...(script ? { language: { sourceType: 'script' as const } } : {}),
    errors: [{ message: PAIR, line: at[0], column: at[1], endLine: at[0], endColumn: at[2] }],
  }
}

// why: the cases recorded from the previous linter leave the escape widths before a reported pair unexercised; these cases cover each escape the offset map reads.
testRule(rule, {
  valid: [{ name: 'a call of another function', path: '/root/file.ts', text: 'other("[👍]")' }],
  invalid: [
    after('a line continuation with a carriage return and a line feed', '"\\\r\n[👍]"', [2, 2, 4]),
    after('a line continuation with a carriage return alone', '"\\\r[👍]"', [2, 2, 4]),
    after('a line continuation with a line separator', '"\\\u2028[👍]"', [2, 2, 4]),
    after('a braced escape inside the basic plane', '"\\u{41}[👍]"', [1, 20, 22]),
    after('a braced escape outside the basic plane', '"[\\u{1F44D}]"', [1, 14, 23]),
    after('a three-digit legacy octal escape', '"\\101[👍]"', [1, 18, 20], true),
    after('a legacy octal escape cut short by its first digit', '"\\400[👍]"', [1, 18, 20], true),
    after('a lone legacy octal digit', '"\\0[👍]"', [1, 16, 18], true),
    after('an escaped non-octal digit', '"\\8[👍]"', [1, 16, 18], true),
  ],
})
