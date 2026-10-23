import type { InvalidCase, RuleCase } from '../../testing/rule-tester'
import { testRule } from '../../testing/rule-tester'
import rule from './for-direction'

testRule(rule, {
  valid: [
    { name: '#1 for(var i = 0; i < 10; i++){}', path: '/root/file.ts', text: 'for(var i = 0; i < 10; i++){}' },
    { name: '#17 for(var i = 0n; i > l; i-=1n){}', path: '/root/file.ts', text: 'for(var i = 0n; i > l; i-=1n){}' },
    { name: '#18 for(var i = 0n; i < l; i-=-1n){}', path: '/root/file.ts', text: 'for(var i = 0n; i < l; i-=-1n){}' },
    { name: '#19 for(var i = MIN; i <= MAX; i+=true){}', path: '/root/file.ts', text: 'for(var i = MIN; i <= MAX; i+=true){}' },
    { name: '#20 for(var i = 0; i < 10; i+=+5e-7){}', path: '/root/file.ts', text: 'for(var i = 0; i < 10; i+=+5e-7){}' },
    { name: '#21 for(var i = 0; i < MAX; i -= ~2);', path: '/root/file.ts', text: 'for(var i = 0; i < MAX; i -= ~2);' },
    { name: '#22 for(var i = 0, n = -1; i < MAX; i += -n);', path: '/root/file.ts', text: 'for(var i = 0, n = -1; i < MAX; i += -n);' },
    { name: '#24 for(var i = 10; i > 0;){}', path: '/root/file.ts', text: 'for(var i = 10; i > 0;){}' },
    { name: '#28 for(var i = 10; i <= 0; j++){}', path: '/root/file.ts', text: 'for(var i = 10; i <= 0; j++){}' },
    { name: '#34 for(var i = 10; i >= 0; i |= 2){}', path: '/root/file.ts', text: 'for(var i = 10; i >= 0; i |= 2){}' },
    { name: '#41 for(var i = 10; i >= 0; i += this.step);', path: '/root/file.ts', text: 'for(var i = 10; i >= 0; i += this.step);' },
    { name: "#42 for(var i = 10; i >= 0; i += 'foo');", path: '/root/file.ts', text: "for(var i = 10; i >= 0; i += 'foo');" },
    { name: '#43 for(var i = 10; i > 0; i += !foo);', path: '/root/file.ts', text: 'for(var i = 10; i > 0; i += !foo);' },
    { name: '#45 for(var i = MIN; i <= MAX; i -= 0/0);', path: '/root/file.ts', text: 'for(var i = MIN; i <= MAX; i -= 0/0);' },
    { name: '#46 for(var i = 0; i !== 10; i+=1){}', path: '/root/file.ts', text: 'for(var i = 0; i !== 10; i+=1){}' },
    { name: '#50 a loop without a test', path: '/root/file.ts', text: 'for (let i = 0; ; i--) {}' },
    { name: '#52 a test that is a call', path: '/root/file.ts', text: 'for (let i = 0; keepGoing(i); i--) {}' },
    { name: '#57 an update of a member with the counter name', path: '/root/file.ts', text: 'for (let i = 0; i < 10; o.i -= 1) {}' },
    { name: '#60 a sequence update', path: '/root/file.ts', text: 'for (let i = 0; i < 10; i++, i--) {}' },
    {
      name: '#62 a step that is reassigned is not resolved',
      path: '/root/file.ts',
      text: 'let n = -2; n = 2; for (let i = 0; i < 10; i += n) {}',
    },
    { name: '#63 a step that is NaN', path: '/root/file.ts', text: 'for (let i = 0; i < 10; i += NaN) {}' },
    {
      name: '#67 a counter behind a type assertion is not recognised',
      path: '/root/file.ts',
      text: 'for (let i = 0; (i as number) < 10; i--) {}',
    },
    { name: '#68 other loop kinds', path: '/root/file.ts', text: 'while (i < 10) i--; for (const k in o) i--; for (const v of a) i--' },
  ],
  invalid: [
    {
      name: '#90 for(var i = 0; i < MAX; i += (2 - 3));',
      path: '/root/file.ts',
      text: 'for(var i = 0; i < MAX; i += (2 - 3));',
      errors: [
        {
          message: 'The update clause in this loop moves the variable in the wrong direction.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 38,
        },
      ],
    },
    {
      name: '#91 var n = -2; for(var i = 0; i < 10; i += n);',
      path: '/root/file.ts',
      text: 'var n = -2; for(var i = 0; i < 10; i += n);',
      errors: [
        {
          message: 'The update clause in this loop moves the variable in the wrong direction.',
          line: 1,
          column: 13,
          endLine: 1,
          endColumn: 43,
        },
      ],
    },
    {
      name: '#93 a parenthesised counter in the update',
      path: '/root/file.ts',
      text: 'for (let i = 0; i < 10; (i)--) /* c */ {}',
      errors: [
        {
          message: 'The update clause in this loop moves the variable in the wrong direction.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 31,
        },
      ],
    },
    {
      name: '#94 a step resolved through a const',
      path: '/root/file.ts',
      text: 'const s = -2\nfor (let i = 0; i < 10; i += s) {}',
      errors: [
        {
          message: 'The update clause in this loop moves the variable in the wrong direction.',
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 32,
        },
      ],
    },
    {
      name: '#100 a loop head spread over lines is reported up to its closing parenthesis',
      path: '/root/file.ts',
      text: 'for (\n  let i = 0;\n  i < 10;\n  i--\n) {}',
      errors: [
        {
          message: 'The update clause in this loop moves the variable in the wrong direction.',
          line: 1,
          column: 1,
          endLine: 5,
          endColumn: 2,
        },
      ],
    },
    {
      name: '#101 a typed counter',
      path: '/root/file.ts',
      text: 'for (let i: number = 0; i < 10; i--) {}',
      errors: [
        {
          message: 'The update clause in this loop moves the variable in the wrong direction.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 37,
        },
      ],
    },
    {
      name: '#102 each wrong loop of a nest',
      path: '/root/file.ts',
      text: 'for (let i = 0; i < 10; i--) { for (let j = 10; j > 0; j++) {} }',
      errors: [
        {
          message: 'The update clause in this loop moves the variable in the wrong direction.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 29,
        },
        {
          message: 'The update clause in this loop moves the variable in the wrong direction.',
          line: 1,
          column: 32,
          endLine: 1,
          endColumn: 60,
        },
      ],
    },
  ],
})

const MESSAGE = 'The update clause in this loop moves the variable in the wrong direction.'

/**
 * A loop counting up under a `<` test, with the given update, as a case.
 *
 * @param name - The case's name
 * @param update - The update clause
 * @param before - Declarations placed before the loop
 * @returns The case, linted as a module
 */
function loop(name: string, update: string, before = ''): RuleCase {
  return { name, path: '/root/file.ts', text: `${before}for (let i = 0; i < 10; ${update}) {}` }
}

/**
 * A loop counting up under a `<` test whose update is reported.
 *
 * @param name - The case's name
 * @param update - The update clause
 * @returns The case with its report over the loop head
 */
function wrong(name: string, update: string): InvalidCase {
  const text = `for (let i = 0; i < 10; ${update}) {}`
  return { name, path: '/root/file.ts', text, errors: [{ message: MESSAGE, line: 1, column: 1, endLine: 1, endColumn: text.length - 2 }] }
}

// why: the cases recorded from the previous linter leave most of the static evaluation unexercised; these cases cover each operator and resolution.
testRule(rule, {
  valid: [
    loop('a negated unknown', 'i += !x'),
    loop('a negated falsy literal', 'i += !0'),
    loop('a plus applied to a bigint', 'i += +1n'),
    loop('a negated string', 'i += -"a"'),
    loop('a typeof', 'i += typeof 1'),
    loop('a comparison', 'i += 1 < 2'),
    loop('a concatenation', "i += 'a' + 'b'"),
    loop('a subtraction from an unknown', 'i += x - 1'),
    loop('a subtraction of an unknown', 'i += 1 - x'),
    loop('a mixed subtraction', 'i += 1n - 2'),
    loop('a product with a positive sign', 'i += 2 * 3'),
    loop('a quotient with a positive sign', 'i += 4 / 2'),
    loop('a power with a positive sign', 'i += 2 ** 2'),
    loop('a global without a known value', 'i += Math'),
    loop('a variable declared twice', 'i += n', 'var n = -1; var n = -2; '),
    loop('a function', 'i += n', 'function n() {} '),
    loop('a destructured constant', 'i += n', 'const { n } = o; '),
    loop('a loop variable without an initialiser', 'i += n', 'for (var n in o) {} '),
  ],
  invalid: [
    wrong('a complemented bigint', 'i += ~1n'),
    wrong('a complemented number', 'i += ~2'),
    wrong('a negative product', 'i += 2 * -1'),
    wrong('a negative quotient', 'i += -4 / 2'),
    wrong('a negative remainder', 'i += -3 % 2'),
    wrong('a negative power', 'i += (-1) ** 3'),
    wrong('a negative sum', 'i += -1 + -1'),
    wrong('a negative constant behind a type assertion', 'i += (-1 as number)'),
    wrong('a negative boolean subtraction', 'i -= true'),
  ],
})
