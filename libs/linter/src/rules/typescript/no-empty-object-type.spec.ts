import { testRule } from '../../testing/rule-tester'
import rule from './no-empty-object-type'

// why: the workspace allows no empty interface, object type or name pattern; the cases with such allowances are left out.
testRule(rule, {
  valid: [
    {
      name: '#2 interface Base {',
      path: '/root/file.ts',
      text: '\ninterface Base {\n  name: string;\n}\n\ninterface Derived {\n  age: number;\n}\n\n// valid because extending multiple interfaces can be used instead of a union type\ninterface Both extends Base, Derived {}\n    ',
    },
    { name: '#8 let value: { inner: true };', path: '/root/file.ts', text: 'let value: { inner: true };' },
    { name: '#9 type MyNonNullable<T> = T & {};', path: '/root/file.ts', text: 'type MyNonNullable<T> = T & {};' },
    { name: '#16 an interface with a call signature', path: '/root/file.ts', text: 'interface Fn {\n  (): void;\n}' },
    { name: '#18 an empty type literal in a nested intersection', path: '/root/file.ts', text: 'type T = U | ({} & V);' },
    { name: '#22 a type literal with an index signature', path: '/root/file.ts', text: 'type T = { [key: string]: unknown };' },
    { name: '#23 an object literal value is not a type', path: '/root/file.ts', text: 'const v = {};' },
  ],
  invalid: [
    {
      name: '#28 interface Base {',
      path: '/root/file.ts',
      text: '\ninterface Base {\n  props: string;\n}\n\ninterface Derived extends Base {}\n\nconst derived = class Derived {};\n      ',
      errors: [
        { message: 'An interface declaring no members is equivalent to its supertype.', line: 6, column: 11, endLine: 6, endColumn: 18 },
      ],
    },
    {
      name: '#31 interface Base extends Array<number | {}> {}',
      path: '/root/file.ts',
      text: 'interface Base extends Array<number | {}> {}',
      errors: [
        { message: 'An interface declaring no members is equivalent to its supertype.', line: 1, column: 11, endLine: 1, endColumn: 15 },
        {
          message:
            'The `{}` ("empty object") type allows any non-nullish value, including literals like `0` and `""`.\n- If that\'s what you want, disable this lint rule with an inline comment or configure the \'allowObjectTypes\' rule option.\n- If you want a type meaning "any object", you probably want `object` instead.\n- If you want a type meaning "any value", you probably want `unknown` instead.',
          line: 1,
          column: 39,
          endLine: 1,
          endColumn: 41,
        },
      ],
    },
    {
      name: '#33 type R = Record<string, unknown>;',
      path: '/root/file.ts',
      text: '\ntype R = Record<string, unknown>;\ninterface Base extends R {}\n      ',
      errors: [
        { message: 'An interface declaring no members is equivalent to its supertype.', line: 3, column: 11, endLine: 3, endColumn: 15 },
      ],
    },
    {
      name: '#34 interface Base<T> extends Derived<T> {}',
      path: '/root/file.ts',
      text: 'interface Base<T> extends Derived<T> {}',
      errors: [
        { message: 'An interface declaring no members is equivalent to its supertype.', line: 1, column: 11, endLine: 1, endColumn: 15 },
      ],
    },
    {
      name: '#35 declare namespace BaseAndDerived {',
      path: '/root/test.d.ts',
      text: '\ndeclare namespace BaseAndDerived {\n  type Base = typeof base;\n  export interface Derived extends Base {}\n}\n      ',
      errors: [
        { message: 'An interface declaring no members is equivalent to its supertype.', line: 4, column: 20, endLine: 4, endColumn: 27 },
      ],
    },
    {
      name: '#40 let value: {',
      path: '/root/file.ts',
      text: '\nlet value: {\n  /* ... */\n};\n      ',
      errors: [
        {
          message:
            'The `{}` ("empty object") type allows any non-nullish value, including literals like `0` and `""`.\n- If that\'s what you want, disable this lint rule with an inline comment or configure the \'allowObjectTypes\' rule option.\n- If you want a type meaning "any object", you probably want `object` instead.\n- If you want a type meaning "any value", you probably want `unknown` instead.',
          line: 2,
          column: 12,
          endLine: 4,
          endColumn: 2,
        },
      ],
    },
    {
      name: '#45 an empty interface merged with a class has no suggestions',
      path: '/root/file.ts',
      text: 'interface Base {}\nclass Base {}',
      errors: [
        {
          message:
            'An empty interface declaration allows any non-nullish value, including literals like `0` and `""`.\n- If that\'s what you want, disable this lint rule with an inline comment or configure the \'allowInterfaces\' rule option.\n- If you want a type meaning "any object", you probably want `object` instead.\n- If you want a type meaning "any value", you probably want `unknown` instead.',
          line: 1,
          column: 11,
          endLine: 1,
          endColumn: 15,
        },
      ],
    },
    {
      name: '#52 an empty type literal as a parameter type',
      path: '/root/file.ts',
      text: 'function f(a: {}): void {}',
      errors: [
        {
          message:
            'The `{}` ("empty object") type allows any non-nullish value, including literals like `0` and `""`.\n- If that\'s what you want, disable this lint rule with an inline comment or configure the \'allowObjectTypes\' rule option.\n- If you want a type meaning "any object", you probably want `object` instead.\n- If you want a type meaning "any value", you probably want `unknown` instead.',
          line: 1,
          column: 15,
          endLine: 1,
          endColumn: 17,
        },
      ],
    },
  ],
})
