import { testRule } from '../../testing/rule-tester.ts'
import rule from './prefer-spread.ts'

testRule(rule, {
  valid: [
    { name: '#1 foo.apply(obj, args);', path: '/root/file.ts', text: 'foo.apply(obj, args);' },
    { name: '#6 foo.apply(undefined, [1, 2]);', path: '/root/file.ts', text: 'foo.apply(undefined, [1, 2]);' },
    { name: '#9 var apply; foo[apply](null, args);', path: '/root/file.ts', text: 'var apply; foo[apply](null, args);' },
    { name: '#12 obj.foo.apply(obj, ...args)', path: '/root/file.ts', text: 'obj.foo.apply(obj, ...args)' },
    { name: '#16 a plain call named apply', path: '/root/file.ts', text: 'apply(null, args);' },
    { name: '#19 a this argument for a function without an owner', path: '/root/file.ts', text: 'foo.apply(this, args);' },
    {
      name: '#23 a computed property with a template literal that is not static',
      path: '/root/file.ts',
      text: 'foo[`${name}`](null, args);',
    },
    { name: '#26 a new expression is not a call', path: '/root/file.ts', text: 'new foo.apply(null, args);' },
    {
      name: '#28 a type-asserted this argument differs by its tokens',
      path: '/root/file.ts',
      text: 'obj.foo.apply(obj as object, args);',
    },
  ],
  invalid: [
    {
      name: '#30 foo.apply(void 0, args);',
      path: '/root/file.ts',
      text: 'foo.apply(void 0, args);',
      errors: [{ message: "Use the spread operator instead of '.apply()'.", line: 1, column: 1, endLine: 1, endColumn: 24 }],
    },
    {
      name: '#36 [].concat.apply([',
      path: '/root/file.ts',
      text: '[].concat.apply([\n/*empty*/\n], args);',
      errors: [{ message: "Use the spread operator instead of '.apply()'.", line: 1, column: 1, endLine: 3, endColumn: 9 }],
    },
    {
      name: '#41 (foo?.apply)?.(undefined, args);',
      path: '/root/file.ts',
      text: '(foo?.apply)?.(undefined, args);',
      errors: [{ message: "Use the spread operator instead of '.apply()'.", line: 1, column: 1, endLine: 1, endColumn: 32 }],
    },
    {
      name: '#46 class C { #foo; foo() { obj.#foo.apply(obj, args); } }',
      path: '/root/file.ts',
      text: 'class C { #foo; foo() { obj.#foo.apply(obj, args); } }',
      errors: [{ message: "Use the spread operator instead of '.apply()'.", line: 1, column: 25, endLine: 1, endColumn: 50 }],
    },
    {
      name: '#48 a computed string property named apply',
      path: '/root/file.ts',
      text: "foo['apply'](null, args);",
      errors: [{ message: "Use the spread operator instead of '.apply()'.", line: 1, column: 1, endLine: 1, endColumn: 25 }],
    },
    {
      name: '#49 a computed template literal property named apply',
      path: '/root/file.ts',
      text: 'foo[`apply`](null, args);',
      errors: [{ message: "Use the spread operator instead of '.apply()'.", line: 1, column: 1, endLine: 1, endColumn: 25 }],
    },
    {
      name: '#56 two calls in one statement',
      path: '/root/file.ts',
      text: 'foo.apply(null, a) + bar.apply(undefined, b);',
      errors: [
        { message: "Use the spread operator instead of '.apply()'.", line: 1, column: 1, endLine: 1, endColumn: 19 },
        { message: "Use the spread operator instead of '.apply()'.", line: 1, column: 22, endLine: 1, endColumn: 45 },
      ],
    },
  ],
})
