import { testRule } from '../../testing/rule-tester'
import rule from './no-unnecessary-type-constraint'

// why: the engine selects a file's language by its extension in the case written, so `FILE.MTS` is not linted; that case is left out.
testRule(rule, {
  valid: [
    { name: '#1 function data() {}', path: '/root/file.ts', text: 'function data() {}' },
    {
      name: '#5 function data<T extends number | string>() {}',
      path: '/root/file.ts',
      text: 'function data<T extends number | string>() {}',
    },
    { name: '#8 const data = () => {};', path: '/root/file.ts', text: 'const data = () => {};' },
    { name: '#13 a constraint on an array of any', path: '/root/file.ts', text: 'function data<T extends any[]>() {}' },
    {
      name: '#14 a constraint on an intersection with unknown',
      path: '/root/file.ts',
      text: 'function data<T extends unknown & object>() {}',
    },
    { name: '#15 a default of unknown without a constraint', path: '/root/file.ts', text: 'function data<T = unknown>() {}' },
    {
      name: '#16 a mapped type key constraint is not a type parameter declaration',
      path: '/root/file.ts',
      text: 'type M = { [K in any]: K };',
    },
  ],
  invalid: [
    {
      name: '#29 const data = <T extends any, U extends any>() => {};',
      path: '/root/react.tsx',
      text: 'const data = <T extends any, U extends any>() => {};',
      errors: [
        {
          message: 'Constraining the generic type `T` to `any` does nothing and is unnecessary.',
          line: 1,
          column: 15,
          endLine: 1,
          endColumn: 28,
        },
        {
          message: 'Constraining the generic type `U` to `any` does nothing and is unnecessary.',
          line: 1,
          column: 30,
          endLine: 1,
          endColumn: 43,
        },
      ],
    },
    {
      name: '#33 class Data<T extends unknown> {}',
      path: '/root/file.ts',
      text: 'class Data<T extends unknown> {}',
      errors: [
        {
          message: 'Constraining the generic type `T` to `unknown` does nothing and is unnecessary.',
          line: 1,
          column: 12,
          endLine: 1,
          endColumn: 29,
        },
      ],
    },
    {
      name: '#36 const Data = class {',
      path: '/root/file.ts',
      text: '\nconst Data = class {\n  member<T extends unknown>() {}\n};\n      ',
      errors: [
        {
          message: 'Constraining the generic type `T` to `unknown` does nothing and is unnecessary.',
          line: 3,
          column: 10,
          endLine: 3,
          endColumn: 27,
        },
      ],
    },
    {
      name: '#37 interface Data<T extends unknown> {}',
      path: '/root/file.ts',
      text: 'interface Data<T extends unknown> {}',
      errors: [
        {
          message: 'Constraining the generic type `T` to `unknown` does nothing and is unnecessary.',
          line: 1,
          column: 16,
          endLine: 1,
          endColumn: 33,
        },
      ],
    },
    {
      name: '#38 type Data<T extends unknown> = {};',
      path: '/root/file.ts',
      text: 'type Data<T extends unknown> = {};',
      errors: [
        {
          message: 'Constraining the generic type `T` to `unknown` does nothing and is unnecessary.',
          line: 1,
          column: 11,
          endLine: 1,
          endColumn: 28,
        },
      ],
    },
    {
      name: '#42 a lone function type parameter in a .tsx file needs no comma',
      path: '/root/file.tsx',
      text: 'type F = <T extends unknown>() => void;',
      errors: [
        {
          message: 'Constraining the generic type `T` to `unknown` does nothing and is unnecessary.',
          line: 1,
          column: 11,
          endLine: 1,
          endColumn: 28,
        },
      ],
    },
    {
      name: '#44 a method signature in an interface',
      path: '/root/file.ts',
      text: 'interface I {\n  m<T extends any>(): void;\n}',
      errors: [
        {
          message: 'Constraining the generic type `T` to `any` does nothing and is unnecessary.',
          line: 2,
          column: 5,
          endLine: 2,
          endColumn: 18,
        },
      ],
    },
  ],
})

testRule(rule, {
  valid: [
    {
      name: 'an inferred type parameter is not a declared one',
      path: '/project/file.ts',
      text: 'type T<X> = X extends [infer U extends unknown] ? U : never;',
    },
  ],
  invalid: [],
})
