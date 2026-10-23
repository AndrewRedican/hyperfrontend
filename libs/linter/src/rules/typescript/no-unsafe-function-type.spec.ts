import { testRule } from '../../testing/rule-tester'
import rule from './no-unsafe-function-type'

testRule(rule, {
  valid: [
    { name: '#2 let value: <T>(t: T) => T;', path: '/root/file.ts', text: 'let value: <T>(t: T) => T;' },
    {
      name: "#3 // create a scope since it's illegal to declare a duplicate …",
      path: '/root/file.ts',
      text: "\n      // create a scope since it's illegal to declare a duplicate identifier\n      // 'Function' in the global script scope.\n      {\n        type Function = () => void;\n        let value: Function;\n      }\n    ",
    },
    { name: '#4 a qualified global name is not an identifier', path: '/root/file.ts', text: 'let value: globalThis.Function;' },
    { name: '#5 a type query of the constructor', path: '/root/file.ts', text: 'let value: typeof Function;' },
    { name: '#6 the constructor as a value', path: '/root/file.ts', text: "const f = new Function('return 1');" },
    {
      name: '#7 an imported type of the name',
      path: '/root/file.ts',
      text: "import type { Function } from './types';\nlet value: Function;",
    },
    {
      name: '#8 a module-scope interface of the name',
      path: '/root/file.ts',
      text: 'interface Function {}\nexport let value: Function;',
    },
    {
      name: '#9 a class implementing a shadowing interface',
      path: '/root/file.ts',
      text: '{\n  interface Function {}\n  class Weird implements Function {}\n}',
    },
    { name: '#11 a type parameter named Function', path: '/root/file.ts', text: 'function f<Function>(value: Function) {}' },
    { name: '#13 a qualified heritage expression', path: '/root/file.ts', text: 'interface Weird extends globalThis.Function {}' },
  ],
  invalid: [
    {
      name: '#15 let value: Function[];',
      path: '/root/file.ts',
      text: 'let value: Function[];',
      errors: [
        {
          message:
            'The `Function` type accepts any function-like value.\nPrefer explicitly defining any function parameters and return type.',
          line: 1,
          column: 12,
          endLine: 1,
          endColumn: 20,
        },
      ],
    },
    {
      name: '#16 let value: Function | number;',
      path: '/root/file.ts',
      text: 'let value: Function | number;',
      errors: [
        {
          message:
            'The `Function` type accepts any function-like value.\nPrefer explicitly defining any function parameters and return type.',
          line: 1,
          column: 12,
          endLine: 1,
          endColumn: 20,
        },
      ],
    },
    {
      name: '#20 a type argument',
      path: '/root/file.ts',
      text: 'let value: Promise<Function>;',
      errors: [
        {
          message:
            'The `Function` type accepts any function-like value.\nPrefer explicitly defining any function parameters and return type.',
          line: 1,
          column: 20,
          endLine: 1,
          endColumn: 28,
        },
      ],
    },
    {
      name: '#21 a parameter and a return type',
      path: '/root/file.ts',
      text: 'function f(cb: Function): Function {\n  return cb;\n}',
      errors: [
        {
          message:
            'The `Function` type accepts any function-like value.\nPrefer explicitly defining any function parameters and return type.',
          line: 1,
          column: 16,
          endLine: 1,
          endColumn: 24,
        },
        {
          message:
            'The `Function` type accepts any function-like value.\nPrefer explicitly defining any function parameters and return type.',
          line: 1,
          column: 27,
          endLine: 1,
          endColumn: 35,
        },
      ],
    },
    {
      name: '#24 a type alias and a type assertion',
      path: '/root/file.ts',
      text: 'type F = Function;\nconst f = g as Function;',
      errors: [
        {
          message:
            'The `Function` type accepts any function-like value.\nPrefer explicitly defining any function parameters and return type.',
          line: 1,
          column: 10,
          endLine: 1,
          endColumn: 18,
        },
        {
          message:
            'The `Function` type accepts any function-like value.\nPrefer explicitly defining any function parameters and return type.',
          line: 2,
          column: 16,
          endLine: 2,
          endColumn: 24,
        },
      ],
    },
  ],
})
