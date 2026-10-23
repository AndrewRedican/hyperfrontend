import { testRule } from '../../testing/rule-tester'
import rule from './no-prototype-builtins'

testRule(rule, {
  valid: [
    {
      name: "#4 Object.prototype.hasOwnProperty.apply(foo, ['bar'])",
      path: '/root/file.ts',
      text: "Object.prototype.hasOwnProperty.apply(foo, ['bar'])",
    },
    { name: '#7 foo.hasOwnProperty', path: '/root/file.ts', text: 'foo.hasOwnProperty' },
    { name: "#13 ({}.hasOwnProperty.call(foo, 'bar'))", path: '/root/file.ts', text: "({}.hasOwnProperty.call(foo, 'bar'))" },
    { name: "#23 foo[1]('bar')", path: '/root/file.ts', text: "foo[1]('bar')" },
    { name: "#24 foo[null]('bar')", path: '/root/file.ts', text: "foo[null]('bar')" },
    {
      name: "#25 class C { #hasOwnProperty; foo() { obj.#hasOwnProperty('bar'…",
      path: '/root/file.ts',
      text: "class C { #hasOwnProperty; foo() { obj.#hasOwnProperty('bar'); } }",
    },
    { name: "#26 foo['hasOwn' + 'Property']('bar')", path: '/root/file.ts', text: "foo['hasOwn' + 'Property']('bar')" },
    { name: "#27 foo[`hasOwnProperty${''}`]('bar')", path: '/root/file.ts', text: "foo[`hasOwnProperty${''}`]('bar')" },
    { name: '#30 a construction, not a call', path: '/root/file.ts', text: "new foo.hasOwnProperty('bar')" },
    { name: '#32 a tagged template is not a call', path: '/root/file.ts', text: 'foo.hasOwnProperty`bar`' },
  ],
  invalid: [
    {
      name: "#41 (function(Object) {return foo.hasOwnProperty('bar');})",
      path: '/root/file.ts',
      text: "(function(Object) {return foo.hasOwnProperty('bar');})",
      errors: [
        {
          message: "Do not access Object.prototype method 'hasOwnProperty' from target object.",
          line: 1,
          column: 31,
          endLine: 1,
          endColumn: 45,
        },
      ],
    },
    {
      name: "#48 (a,b).hasOwnProperty('bar')",
      path: '/root/file.ts',
      text: "(a,b).hasOwnProperty('bar')",
      errors: [
        {
          message: "Do not access Object.prototype method 'hasOwnProperty' from target object.",
          line: 1,
          column: 7,
          endLine: 1,
          endColumn: 21,
        },
      ],
    },
    {
      name: "#52 (foo?.[`hasOwnProperty`])('bar')",
      path: '/root/file.ts',
      text: "(foo?.[`hasOwnProperty`])('bar')",
      errors: [
        {
          message: "Do not access Object.prototype method 'hasOwnProperty' from target object.",
          line: 1,
          column: 8,
          endLine: 1,
          endColumn: 24,
        },
      ],
    },
    {
      name: '#54 an optional call in the chain gets no suggestion',
      path: '/root/file.ts',
      text: "foo?.().hasOwnProperty('bar')",
      errors: [
        {
          message: "Do not access Object.prototype method 'hasOwnProperty' from target object.",
          line: 1,
          column: 9,
          endLine: 1,
          endColumn: 23,
        },
      ],
    },
    {
      name: '#58 spread arguments',
      path: '/root/file.ts',
      text: 'foo.hasOwnProperty(...args)',
      errors: [
        {
          message: "Do not access Object.prototype method 'hasOwnProperty' from target object.",
          line: 1,
          column: 5,
          endLine: 1,
          endColumn: 19,
        },
      ],
    },
    {
      name: '#59 comments around the parenthesis are kept',
      path: '/root/file.ts',
      text: "foo.hasOwnProperty /* x */ ( /* y */ 'bar')",
      errors: [
        {
          message: "Do not access Object.prototype method 'hasOwnProperty' from target object.",
          line: 1,
          column: 5,
          endLine: 1,
          endColumn: 19,
        },
      ],
    },
    {
      name: '#60 an assignment object binds tighter than a sequence and needs no parentheses',
      path: '/root/file.ts',
      text: '(a = b).hasOwnProperty(c)',
      errors: [
        {
          message: "Do not access Object.prototype method 'hasOwnProperty' from target object.",
          line: 1,
          column: 9,
          endLine: 1,
          endColumn: 23,
        },
      ],
    },
    {
      name: '#61 a conditional object',
      path: '/root/file.ts',
      text: '(a ? b : c).hasOwnProperty(d)',
      errors: [
        {
          message: "Do not access Object.prototype method 'hasOwnProperty' from target object.",
          line: 1,
          column: 13,
          endLine: 1,
          endColumn: 27,
        },
      ],
    },
    {
      name: '#62 an arrow function object',
      path: '/root/file.ts',
      text: '(x => x).hasOwnProperty(y)',
      errors: [
        {
          message: "Do not access Object.prototype method 'hasOwnProperty' from target object.",
          line: 1,
          column: 10,
          endLine: 1,
          endColumn: 24,
        },
      ],
    },
    {
      name: '#64 an await as the object',
      path: '/root/file.ts',
      text: 'async function f() { (await x).hasOwnProperty(y) }',
      errors: [
        {
          message: "Do not access Object.prototype method 'hasOwnProperty' from target object.",
          line: 1,
          column: 32,
          endLine: 1,
          endColumn: 46,
        },
      ],
    },
    {
      name: '#65 a non-null assertion as the object is parenthesised, as its precedence is unknown',
      path: '/root/file.ts',
      text: "foo!.hasOwnProperty('bar')",
      errors: [
        {
          message: "Do not access Object.prototype method 'hasOwnProperty' from target object.",
          line: 1,
          column: 6,
          endLine: 1,
          endColumn: 20,
        },
      ],
    },
    {
      name: '#66 a type assertion as the object is parenthesised, as its precedence is unknown',
      path: '/root/file.ts',
      text: "(foo as Bar).propertyIsEnumerable('x')",
      errors: [
        {
          message: "Do not access Object.prototype method 'propertyIsEnumerable' from target object.",
          line: 1,
          column: 14,
          endLine: 1,
          endColumn: 34,
        },
      ],
    },
    {
      name: '#67 Object shadowed at the module level gets no suggestion',
      path: '/root/file.ts',
      text: "const Object = {}; foo.hasOwnProperty('bar')",
      errors: [
        {
          message: "Do not access Object.prototype method 'hasOwnProperty' from target object.",
          line: 1,
          column: 24,
          endLine: 1,
          endColumn: 38,
        },
      ],
    },
    {
      name: '#68 Object declared in the global scope of a script gets no suggestion',
      path: '/root/file.ts',
      text: 'var Object; foo.isPrototypeOf(bar)',
      language: { sourceType: 'script' },
      errors: [
        {
          message: "Do not access Object.prototype method 'isPrototypeOf' from target object.",
          line: 1,
          column: 17,
          endLine: 1,
          endColumn: 30,
        },
      ],
    },
    {
      name: '#70 each call is reported at its property',
      path: '/root/file.ts',
      text: 'foo.hasOwnProperty(a); bar.isPrototypeOf(b)',
      errors: [
        {
          message: "Do not access Object.prototype method 'hasOwnProperty' from target object.",
          line: 1,
          column: 5,
          endLine: 1,
          endColumn: 19,
        },
        {
          message: "Do not access Object.prototype method 'isPrototypeOf' from target object.",
          line: 1,
          column: 28,
          endLine: 1,
          endColumn: 41,
        },
      ],
    },
    {
      name: '#71 a call spanning lines is reported at the property',
      path: '/root/file.ts',
      text: "foo\n  .hasOwnProperty(\n    'bar'\n  )",
      errors: [
        {
          message: "Do not access Object.prototype method 'hasOwnProperty' from target object.",
          line: 2,
          column: 4,
          endLine: 2,
          endColumn: 18,
        },
      ],
    },
  ],
})
