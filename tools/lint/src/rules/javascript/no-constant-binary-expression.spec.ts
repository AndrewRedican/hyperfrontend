import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-constant-binary-expression.ts'

testRule(rule, {
  valid: [
    { name: '#4 `${foo}${bar}` == true', path: '/root/file.ts', text: '`${foo}${bar}` == true' },
    { name: '#9 delete bar.baz === true', path: '/root/file.ts', text: 'delete bar.baz === true' },
    {
      name: '#11 function Boolean(n) { return Math.random(); }; Boolean(1) ==…',
      path: '/root/file.ts',
      text: 'function Boolean(n) { return Math.random(); }; Boolean(1) == true',
    },
    {
      name: '#15 function foo(undefined) { undefined == true;}',
      path: '/root/file.ts',
      text: 'function foo(undefined) { undefined == true;}',
    },
    {
      name: '#16 function foo(undefined) { undefined === true;}',
      path: '/root/file.ts',
      text: 'function foo(undefined) { undefined === true;}',
    },
    { name: '#19 new Foo() === bar;', path: '/root/file.ts', text: 'new Foo() === bar;', language: { globals: { Foo: 'writable' } } },
    {
      name: '#20 operators outside equality are not judged',
      path: '/root/file.ts',
      text: 'a < {}; a in {}; a + {}; a instanceof Foo; a > null; a <= undefined; true - 1',
    },
    { name: '#24 a shadowed builtin constructor', path: '/root/file.ts', text: 'class Map {}; a === new Map()' },
    { name: '#26 a conditional with one branch that is not new', path: '/root/file.ts', text: 'a === (b ? {} : c)' },
    {
      name: '#28 a negation of a variable against a boolean',
      path: '/root/file.ts',
      text: 'true === !a; true == !a; !a === b; !a == true',
    },
    { name: '#31 a comparison against a strict boolean', path: '/root/file.ts', text: 'true === (a < b); true === (a instanceof b)' },
    {
      name: '#33 logical assignments against a strict boolean',
      path: '/root/file.ts',
      text: 'true === (a ||= 1); true === (a &&= 1); true === (a ??= 1)',
    },
    { name: '#34 a plain assignment of a variable against a boolean', path: '/root/file.ts', text: 'true === (a = b); true == (a = b)' },
    { name: '#35 a sequence ending in a variable against a boolean', path: '/root/file.ts', text: 'true === (a, b); true == (a, b)' },
    {
      name: '#37 calls of other functions against a boolean',
      path: '/root/file.ts',
      text: 'true === foo(); true === a.b(); true == foo(a); true == a.b()',
    },
    {
      name: '#38 a shadowed String call against a strict boolean',
      path: '/root/file.ts',
      text: 'function String(n) { return n; }; String(x) === true',
    },
    {
      name: '#46 a spread array and a holey array against a loose boolean',
      path: '/root/file.ts',
      text: 'true == [...a, b]; true == [, ,]',
    },
    {
      name: '#55 JSX on either side',
      path: '/root/react.tsx',
      text: '<></> == null; true == <div />; true === <></>; a === <div />; <div /> == <div />',
    },
    { name: '#56 an await against null', path: '/root/file.ts', text: 'async function f() { return (await a) == null }' },
    { name: '#232 (x += 1) && foo', path: '/root/file.ts', text: '(x += 1) && foo' },
    { name: '#233 `${bar}` && foo', path: '/root/file.ts', text: '`${bar}` && foo' },
    { name: '#235 delete bar.baz && foo', path: '/root/file.ts', text: 'delete bar.baz && foo' },
    {
      name: '#240 function Number(n) { return n; }; Number(x) ?? foo',
      path: '/root/file.ts',
      text: 'function Number(n) { return n; }; Number(x) ?? foo',
    },
    { name: '#244 a ?? (doSomething(), undefined) ?? b', path: '/root/file.ts', text: 'a ?? (doSomething(), undefined) ?? b' },
    { name: '#248 a conditional expression on the left of a nullish coalescing', path: '/root/file.ts', text: '(a ? b : c) ?? d' },
    {
      name: '#249 a call through an optional chain on the left of a nullish coalescing',
      path: '/root/file.ts',
      text: 'Boolean?.(a) ?? b',
    },
    { name: '#258 a logical assignment of a variable on the left of a logical and', path: '/root/file.ts', text: '(a ||= b) && c' },
    {
      name: '#260 a this expression on the left of a nullish coalescing',
      path: '/root/file.ts',
      text: 'function f() { return this ?? a }',
    },
  ],
  invalid: [
    {
      name: '#62 !foo == null',
      path: '/root/file.ts',
      text: '!foo == null',
      errors: [
        {
          message: 'Unexpected constant binary expression. Compares constantly with the right-hand side of the `==`.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 5,
        },
      ],
    },
    {
      name: '#71 ([a, b]) == true',
      path: '/root/file.ts',
      text: '([a, b]) == true',
      errors: [
        {
          message: 'Unexpected constant binary expression. Compares constantly with the right-hand side of the `==`.',
          line: 1,
          column: 2,
          endLine: 1,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#75 typeof foo == true',
      path: '/root/file.ts',
      text: 'typeof foo == true',
      errors: [
        {
          message: 'Unexpected constant binary expression. Compares constantly with the right-hand side of the `==`.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 11,
        },
      ],
    },
    {
      name: '#82 /[a-z]/ == true',
      path: '/root/file.ts',
      text: '/[a-z]/ == true',
      errors: [
        {
          message: 'Unexpected constant binary expression. Compares constantly with the right-hand side of the `==`.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#85 ({}) == Boolean(() => {}, foo)',
      path: '/root/file.ts',
      text: '({}) == Boolean(() => {}, foo)',
      errors: [
        {
          message: 'Unexpected constant binary expression. Compares constantly with the right-hand side of the `==`.',
          line: 1,
          column: 2,
          endLine: 1,
          endColumn: 4,
        },
      ],
    },
    {
      name: "#100 'hello' === true",
      path: '/root/file.ts',
      text: "'hello' === true",
      errors: [
        {
          message: 'Unexpected constant binary expression. Compares constantly with the right-hand side of the `===`.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#103 (a = {}) === true',
      path: '/root/file.ts',
      text: '(a = {}) === true',
      errors: [
        {
          message: 'Unexpected constant binary expression. Compares constantly with the right-hand side of the `===`.',
          line: 1,
          column: 2,
          endLine: 1,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#108 (a ** b) === true',
      path: '/root/file.ts',
      text: '(a ** b) === true',
      errors: [
        {
          message: 'Unexpected constant binary expression. Compares constantly with the right-hand side of the `===`.',
          line: 1,
          column: 2,
          endLine: 1,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#112 --a === true',
      path: '/root/file.ts',
      text: '--a === true',
      errors: [
        {
          message: 'Unexpected constant binary expression. Compares constantly with the right-hand side of the `===`.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 4,
        },
      ],
    },
    {
      name: '#113 a-- === true',
      path: '/root/file.ts',
      text: 'a-- === true',
      errors: [
        {
          message: 'Unexpected constant binary expression. Compares constantly with the right-hand side of the `===`.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 4,
        },
      ],
    },
    {
      name: '#150 (x = {}) === null',
      path: '/root/file.ts',
      text: '(x = {}) === null',
      errors: [
        {
          message: 'Unexpected constant binary expression. Compares constantly with the right-hand side of the `===`.',
          line: 1,
          column: 2,
          endLine: 1,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#166 null === undefined',
      path: '/root/file.ts',
      text: 'null === undefined',
      errors: [
        {
          message: 'Unexpected constant binary expression. Compares constantly with the left-hand side of the `===`.',
          line: 1,
          column: 10,
          endLine: 1,
          endColumn: 19,
        },
      ],
    },
    {
      name: '#200 a function and an arrow compared loosely',
      path: '/root/file.ts',
      text: '(() => 1) == (function () {})',
      errors: [
        {
          message: 'Unexpected comparison of two newly constructed objects. These two values can never be equal.',
          line: 1,
          column: 2,
          endLine: 1,
          endColumn: 9,
        },
      ],
    },
    {
      name: '#202 two regular expressions compared strictly',
      path: '/root/file.ts',
      text: '/a/ !== /b/',
      errors: [
        {
          message: 'Unexpected comparison to newly constructed object. These two values can never be equal.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 4,
        },
      ],
    },
    {
      name: '#224 each constant comparison of a file',
      path: '/root/file.ts',
      text: 'const r = [a == null && true === 1, x === []]',
      errors: [
        {
          message: 'Unexpected constant binary expression. Compares constantly with the left-hand side of the `===`.',
          line: 1,
          column: 34,
          endLine: 1,
          endColumn: 35,
        },
        {
          message: 'Unexpected comparison to newly constructed object. These two values can never be equal.',
          line: 1,
          column: 43,
          endLine: 1,
          endColumn: 45,
        },
      ],
    },
    {
      name: '#225 a comparison with typed operands',
      path: '/root/file.ts',
      text: 'function f(x: number) { return x === {} }',
      errors: [
        {
          message: 'Unexpected comparison to newly constructed object. These two values can never be equal.',
          line: 1,
          column: 38,
          endLine: 1,
          endColumn: 40,
        },
      ],
    },
    {
      name: '#269 [foo?.bar ?? ""] ?? []',
      path: '/root/file.ts',
      text: '[foo?.bar ?? ""] ?? []',
      errors: [
        {
          message: 'Unexpected constant nullishness on the left-hand side of a `??` expression.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 17,
        },
      ],
    },
    {
      name: '#279 Boolean([]) && foo',
      path: '/root/file.ts',
      text: 'Boolean([]) && foo',
      errors: [
        {
          message: 'Unexpected constant truthiness on the left-hand side of a `&&` expression.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 12,
        },
      ],
    },
    {
      name: '#287 (class { valueOf() { return x; } }) && foo',
      path: '/root/file.ts',
      text: '(class { valueOf() { return x; } }) && foo',
      errors: [
        {
          message: 'Unexpected constant truthiness on the left-hand side of a `&&` expression.',
          line: 1,
          column: 2,
          endLine: 1,
          endColumn: 35,
        },
      ],
    },
    {
      name: '#288 (class { [x]() { return x; } }) && foo',
      path: '/root/file.ts',
      text: '(class { [x]() { return x; } }) && foo',
      errors: [
        {
          message: 'Unexpected constant truthiness on the left-hand side of a `&&` expression.',
          line: 1,
          column: 2,
          endLine: 1,
          endColumn: 31,
        },
      ],
    },
    {
      name: '#289 new Foo() && foo',
      path: '/root/file.ts',
      text: 'new Foo() && foo',
      errors: [
        {
          message: 'Unexpected constant truthiness on the left-hand side of a `&&` expression.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 10,
        },
      ],
    },
    {
      name: '#293 (bar[0] = false) && foo',
      path: '/root/file.ts',
      text: '(bar[0] = false) && foo',
      errors: [
        {
          message: 'Unexpected constant truthiness on the left-hand side of a `&&` expression.',
          line: 1,
          column: 2,
          endLine: 1,
          endColumn: 16,
        },
      ],
    },
    {
      name: '#297 typeof bar && foo',
      path: '/root/file.ts',
      text: 'typeof bar && foo',
      errors: [
        {
          message: 'Unexpected constant truthiness on the left-hand side of a `&&` expression.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 11,
        },
      ],
    },
    {
      name: '#298 (bar, baz, true) && foo',
      path: '/root/file.ts',
      text: '(bar, baz, true) && foo',
      errors: [
        {
          message: 'Unexpected constant truthiness on the left-hand side of a `&&` expression.',
          line: 1,
          column: 2,
          endLine: 1,
          endColumn: 16,
        },
      ],
    },
    {
      name: '#299 undefined && foo',
      path: '/root/file.ts',
      text: 'undefined && foo',
      errors: [
        {
          message: 'Unexpected constant truthiness on the left-hand side of a `&&` expression.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 10,
        },
      ],
    },
    {
      name: "#308 `${''}` ?? foo",
      path: '/root/file.ts',
      text: "`${''}` ?? foo",
      errors: [
        {
          message: 'Unexpected constant nullishness on the left-hand side of a `??` expression.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#316 (a >>= 1) ?? foo',
      path: '/root/file.ts',
      text: '(a >>= 1) ?? foo',
      errors: [
        {
          message: 'Unexpected constant nullishness on the left-hand side of a `??` expression.',
          line: 1,
          column: 2,
          endLine: 1,
          endColumn: 9,
        },
      ],
    },
    {
      name: '#340 window.abc && false && anything',
      path: '/root/file.ts',
      text: 'window.abc && false && anything',
      errors: [
        {
          message: 'Unexpected constant truthiness on the left-hand side of a `&&` expression.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 20,
        },
      ],
    },
    {
      name: '#343 the constant left side is the reported node',
      path: '/root/file.ts',
      text: 'true &&\n  foo',
      errors: [
        {
          message: 'Unexpected constant truthiness on the left-hand side of a `&&` expression.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 5,
        },
      ],
    },
    {
      name: '#348 a logical assignment of a truthy literal on the left of a logical or',
      path: '/root/file.ts',
      text: '(a ||= 1) || b',
      errors: [
        {
          message: 'Unexpected constant truthiness on the left-hand side of a `||` expression.',
          line: 1,
          column: 2,
          endLine: 1,
          endColumn: 9,
        },
      ],
    },
    {
      name: '#362 a constant left side in a typed declaration',
      path: '/root/file.ts',
      text: 'const value: string = `x` ?? fallback',
      errors: [
        {
          message: 'Unexpected constant nullishness on the left-hand side of a `??` expression.',
          line: 1,
          column: 23,
          endLine: 1,
          endColumn: 26,
        },
      ],
    },
  ],
})

testRule(rule, {
  valid: [
    {
      name: 'a nullish coalescing to a falsy literal under an and',
      path: '/root/file.ts',
      text: 'export const x = (a?.b ?? false) && c\n',
    },
  ],
  invalid: [],
})
