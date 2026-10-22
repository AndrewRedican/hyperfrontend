import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-shadow-restricted-names.ts'

// why: the workspace runs the rule with `reportGlobalThis` off; the cases with it on are left out.
testRule(rule, {
  valid: [
    { name: '#3 !function(bar){ var baz; }', path: '/root/file.ts', text: '!function(bar){ var baz; }' },
    { name: '#5 export default function() {}', path: '/root/file.ts', text: 'export default function() {}' },
    { name: '#10 let undefined', path: '/root/file.ts', text: 'let undefined' },
    { name: "#11 import { undefined as undef } from 'foo';", path: '/root/file.ts', text: "import { undefined as undef } from 'foo';" },
    {
      name: '#21 a restricted name used as a property key is not a binding',
      path: '/root/file.ts',
      text: 'var o = { undefined: 1, NaN: 2, eval: 3 };',
    },
    {
      name: '#22 a restricted name used as a label is not a binding',
      path: '/root/file.ts',
      text: 'undefined: for (;;) { break undefined; }',
    },
    {
      name: '#23 a default parameter value referencing undefined declares nothing',
      path: '/root/file.ts',
      text: 'function f(a = undefined) {}',
    },
    {
      name: '#24 an interface named like a restricted name is not a value binding',
      path: '/root/file.ts',
      text: 'interface NaN { x: number }',
    },
    {
      name: '#25 a type parameter named like a restricted name is not a value binding',
      path: '/root/file.ts',
      text: 'function f<Infinity>(x: Infinity): Infinity { return x; }',
    },
    {
      name: '#26 a method named like a restricted name is not a binding',
      path: '/root/file.ts',
      text: 'class A { eval() {} static arguments() {} }',
    },
    { name: '#27 an unassigned undefined declared in a block', path: '/root/file.ts', text: '{ let undefined; log(undefined); }' },
    {
      name: '#28 an unassigned undefined declared at the top level of a script',
      path: '/root/file.ts',
      text: 'var undefined; var x = undefined;',
      language: { sourceType: 'script' },
    },
    { name: '#29 an export of an ordinary name', path: '/root/file.ts', text: 'export const foo = 1; export function bar() {}' },
  ],
  invalid: [
    {
      name: '#35 var eval = (eval) => { var eval; !function eval(eval) { try …',
      path: '/root/file.ts',
      text: 'var eval = (eval) => { var eval; !function eval(eval) { try {} catch(eval) {} }; }',
      errors: [
        { message: "Shadowing of global property 'eval'.", line: 1, column: 5, endLine: 1, endColumn: 9 },
        { message: "Shadowing of global property 'eval'.", line: 1, column: 13, endLine: 1, endColumn: 17 },
        { message: "Shadowing of global property 'eval'.", line: 1, column: 28, endLine: 1, endColumn: 32 },
        { message: "Shadowing of global property 'eval'.", line: 1, column: 44, endLine: 1, endColumn: 48 },
        { message: "Shadowing of global property 'eval'.", line: 1, column: 49, endLine: 1, endColumn: 53 },
        { message: "Shadowing of global property 'eval'.", line: 1, column: 70, endLine: 1, endColumn: 74 },
      ],
    },
    {
      name: '#36 var [undefined] = [1]',
      path: '/root/file.ts',
      text: 'var [undefined] = [1]',
      errors: [{ message: "Shadowing of global property 'undefined'.", line: 1, column: 6, endLine: 1, endColumn: 15 }],
    },
    {
      name: '#37 var {undefined} = obj; var {a: undefined} = obj; var {a: {b:…',
      path: '/root/file.ts',
      text: 'var {undefined} = obj; var {a: undefined} = obj; var {a: {b: {undefined}}} = obj; var {a, ...undefined} = obj;',
      errors: [
        { message: "Shadowing of global property 'undefined'.", line: 1, column: 6, endLine: 1, endColumn: 15 },
        { message: "Shadowing of global property 'undefined'.", line: 1, column: 32, endLine: 1, endColumn: 41 },
        { message: "Shadowing of global property 'undefined'.", line: 1, column: 63, endLine: 1, endColumn: 72 },
        { message: "Shadowing of global property 'undefined'.", line: 1, column: 94, endLine: 1, endColumn: 103 },
      ],
    },
    {
      name: '#38 var undefined; undefined = 5;',
      path: '/root/file.ts',
      text: 'var undefined; undefined = 5;',
      errors: [{ message: "Shadowing of global property 'undefined'.", line: 1, column: 5, endLine: 1, endColumn: 14 }],
    },
    {
      name: '#40 (class undefined {})',
      path: '/root/file.ts',
      text: '(class undefined {})',
      errors: [{ message: "Shadowing of global property 'undefined'.", line: 1, column: 8, endLine: 1, endColumn: 17 }],
    },
    {
      name: "#42 import { undefined } from 'foo';",
      path: '/root/file.ts',
      text: "import { undefined } from 'foo';",
      errors: [{ message: "Shadowing of global property 'undefined'.", line: 1, column: 10, endLine: 1, endColumn: 19 }],
    },
    {
      name: "#44 import * as undefined from 'foo';",
      path: '/root/file.ts',
      text: "import * as undefined from 'foo';",
      errors: [{ message: "Shadowing of global property 'undefined'.", line: 1, column: 13, endLine: 1, endColumn: 22 }],
    },
    {
      name: '#55 an initialised undefined is reported',
      path: '/root/file.ts',
      text: 'var undefined = void 0;',
      errors: [{ message: "Shadowing of global property 'undefined'.", line: 1, column: 5, endLine: 1, endColumn: 14 }],
    },
    {
      name: '#59 a method parameter named Infinity',
      path: '/root/file.ts',
      text: 'class A { m(Infinity) {} }',
      errors: [{ message: "Shadowing of global property 'Infinity'.", line: 1, column: 13, endLine: 1, endColumn: 21 }],
    },
    {
      name: '#61 a type-only import named undefined',
      path: '/root/file.ts',
      text: "import type undefined from 'foo';",
      errors: [{ message: "Shadowing of global property 'undefined'.", line: 1, column: 13, endLine: 1, endColumn: 22 }],
    },
    {
      name: '#64 a rest parameter named arguments',
      path: '/root/file.ts',
      text: 'const f = (...arguments) => arguments;',
      errors: [{ message: "Shadowing of global property 'arguments'.", line: 1, column: 15, endLine: 1, endColumn: 24 }],
    },
    {
      name: '#65 a for-of loop variable named undefined',
      path: '/root/file.ts',
      text: 'for (const undefined of list) {}',
      errors: [{ message: "Shadowing of global property 'undefined'.", line: 1, column: 12, endLine: 1, endColumn: 21 }],
    },
    {
      name: '#66 declarations on later lines carry their own location',
      path: '/root/file.ts',
      text: 'var a;\n  let Infinity;\nconst NaN = 1;',
      errors: [
        { message: "Shadowing of global property 'Infinity'.", line: 2, column: 7, endLine: 2, endColumn: 15 },
        { message: "Shadowing of global property 'NaN'.", line: 3, column: 7, endLine: 3, endColumn: 10 },
      ],
    },
  ],
})
