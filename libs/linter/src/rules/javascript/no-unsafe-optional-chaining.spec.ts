import { testRule } from '../../testing/rule-tester'
import rule from './no-unsafe-optional-chaining'

// why: the workspace runs the rule with its default options, so the cases disallowing arithmetic are left out; the parser refuses `with`, so its two cases are too.
testRule(rule, {
  valid: [
    { name: '#1 var foo;', path: '/root/file.ts', text: 'var foo;' },
    { name: '#3 !!obj?.foo', path: '/root/file.ts', text: '!!obj?.foo' },
    { name: '#27 foo?.bar < foo?.baz;', path: '/root/file.ts', text: 'foo?.bar < foo?.baz;' },
    { name: '#29 foo?.bar > foo?.baz;', path: '/root/file.ts', text: 'foo?.bar > foo?.baz;' },
    { name: '#30 foo?.bar >= foo?.baz;', path: '/root/file.ts', text: 'foo?.bar >= foo?.baz;' },
    { name: '#33 ({foo = obj?.bar} = obj);', path: '/root/file.ts', text: '({foo = obj?.bar} = obj);' },
    { name: '#34 ({foo: obj.bar = obj?.baz} = obj);', path: '/root/file.ts', text: '({foo: obj.bar = obj?.baz} = obj);' },
    {
      name: '#37 async function func() {',
      path: '/root/file.ts',
      text: '\n        async function func() {\n          await obj?.foo();\n          await obj?.foo?.();\n          (await obj?.foo)?.();\n          (await obj?.foo)?.bar;\n          await bar?.baz;\n          await (foo ?? obj?.foo.baz);\n          (await bar?.baz ?? bar).baz;\n          (await bar?.baz ?? await bar).baz;\n          await (foo?.bar ? baz : qux);\n        }\n        ',
    },
    { name: '#38 (obj?.foo ?? bar?.baz ?? qux)();', path: '/root/file.ts', text: '(obj?.foo ?? bar?.baz ?? qux)();' },
    { name: '#47 obj?.foo ** bar;', path: '/root/file.ts', text: 'obj?.foo ** bar;' },
    { name: '#55 bar /= obj?.boo', path: '/root/file.ts', text: 'bar /= obj?.boo' },
    { name: '#92 a chain narrowed by a type assertion is a different node', path: '/root/file.ts', text: '(obj?.foo as Foo).bar;' },
    {
      name: '#93 a chain checked by a satisfies expression is a different node',
      path: '/root/file.ts',
      text: '(obj?.foo satisfies Foo).bar;',
    },
    { name: '#94 a chain narrowed by an angle-bracket assertion is a different node', path: '/root/file.ts', text: '(<Foo>obj?.foo)();' },
    { name: '#95 a destructuring loop variable has no initializer to check', path: '/root/file.ts', text: 'for (const {a} of list) {}' },
    { name: '#96 a destructuring parameter without a default', path: '/root/file.ts', text: 'function f({a}) {}' },
    {
      name: '#100 a spread of a chain into an object literal with a method',
      path: '/root/file.ts',
      text: 'var bar = { m() {}, ...foo?.bar };',
    },
  ],
  invalid: [
    {
      name: '#118 async function foo() {',
      path: '/root/file.ts',
      text: 'async function foo() {\n              (bar && await obj?.foo)();\n            }',
      errors: [
        {
          message: "Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError.",
          line: 2,
          column: 29,
          endLine: 2,
          endColumn: 37,
        },
      ],
    },
    {
      name: '#120 [...obj?.foo];',
      path: '/root/file.ts',
      text: '[...obj?.foo];',
      errors: [
        {
          message: "Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError.",
          line: 1,
          column: 5,
          endLine: 1,
          endColumn: 13,
        },
      ],
    },
    {
      name: '#122 new Bar(...obj?.foo);',
      path: '/root/file.ts',
      text: 'new Bar(...obj?.foo);',
      errors: [
        {
          message: "Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError.",
          line: 1,
          column: 12,
          endLine: 1,
          endColumn: 20,
        },
      ],
    },
    {
      name: '#131 ({bar: [ foo ] = obj?.prop} = {});',
      path: '/root/file.ts',
      text: '({bar: [ foo ] = obj?.prop} = {});',
      errors: [
        {
          message: "Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError.",
          line: 1,
          column: 18,
          endLine: 1,
          endColumn: 27,
        },
      ],
    },
    {
      name: '#145 for (foo of obj?.bar);',
      path: '/root/file.ts',
      text: 'for (foo of obj?.bar);',
      errors: [
        {
          message: "Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError.",
          line: 1,
          column: 13,
          endLine: 1,
          endColumn: 21,
        },
      ],
    },
    {
      name: '#148 (foo, obj?.foo)[1];',
      path: '/root/file.ts',
      text: '(foo, obj?.foo)[1];',
      errors: [
        {
          message: "Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError.",
          line: 1,
          column: 7,
          endLine: 1,
          endColumn: 15,
        },
      ],
    },
    {
      name: '#166 (foo ? obj?.foo : obj?.bar).bar',
      path: '/root/file.ts',
      text: '(foo ? obj?.foo : obj?.bar).bar',
      errors: [
        {
          message: "Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError.",
          line: 1,
          column: 8,
          endLine: 1,
          endColumn: 16,
        },
        {
          message: "Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError.",
          line: 1,
          column: 19,
          endLine: 1,
          endColumn: 27,
        },
      ],
    },
    {
      name: '#201 a class expression without a name extending a chain',
      path: '/root/file.ts',
      text: 'const B = class extends obj?.foo {};',
      errors: [
        {
          message: "Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError.",
          line: 1,
          column: 25,
          endLine: 1,
          endColumn: 33,
        },
      ],
    },
    {
      name: '#202 a new expression with type arguments on a chain',
      path: '/root/file.ts',
      text: 'new (obj?.foo)<string>();',
      errors: [
        {
          message: "Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError.",
          line: 1,
          column: 6,
          endLine: 1,
          endColumn: 14,
        },
      ],
    },
    {
      name: '#211 a non-null assertion stays inside the chain, so the member access is reported',
      path: '/root/file.ts',
      text: '(obj?.foo!).bar;',
      errors: [
        {
          message: "Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError.",
          line: 1,
          column: 2,
          endLine: 1,
          endColumn: 11,
        },
      ],
    },
    {
      name: '#212 a chain tagged template inside an async arrow',
      path: '/root/file.ts',
      text: 'const f = async () => (await obj?.foo)`x`;',
      errors: [
        {
          message: "Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError.",
          line: 1,
          column: 30,
          endLine: 1,
          endColumn: 38,
        },
      ],
    },
    {
      name: '#213 a chain in the right operand of in inside a class field',
      path: '/root/file.ts',
      text: 'class A { x = "a" in obj?.foo; }',
      errors: [
        {
          message: "Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError.",
          line: 1,
          column: 22,
          endLine: 1,
          endColumn: 30,
        },
      ],
    },
  ],
})
