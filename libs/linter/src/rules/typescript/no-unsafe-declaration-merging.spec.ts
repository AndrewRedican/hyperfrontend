import { testRule } from '../../testing/rule-tester'
import rule from './no-unsafe-declaration-merging'

testRule(rule, {
  valid: [
    { name: '#1 interface Foo {}', path: '/root/file.ts', text: '\ninterface Foo {}\nclass Bar implements Foo {}\n    ' },
    { name: '#3 enum Foo {}', path: '/root/file.ts', text: '\nenum Foo {}\nnamespace Foo {}\n    ' },
    { name: '#5 const Foo = class {};', path: '/root/file.ts', text: '\nconst Foo = class {};\n    ' },
    {
      name: '#6 interface Foo {',
      path: '/root/file.ts',
      text: '\ninterface Foo {\n  props: string;\n}\n\nfunction bar() {\n  return class Foo {};\n}\n    ',
    },
    {
      name: '#7 interface Foo {',
      path: '/root/file.ts',
      text: '\ninterface Foo {\n  props: string;\n}\n\n(function bar() {\n  class Foo {}\n})();\n    ',
    },
    { name: '#8 declare global {', path: '/root/file.ts', text: '\ndeclare global {\n  interface Foo {}\n}\n\nclass Foo {}\n    ' },
    { name: '#13 an anonymous default-exported class', path: '/root/file.ts', text: 'interface Foo {}\nexport default class {}' },
    {
      name: '#14 a class and an interface of the same name in different blocks',
      path: '/root/file.ts',
      text: '{\n  interface Foo {}\n}\n{\n  class Foo {}\n}',
    },
  ],
  invalid: [
    {
      name: '#20 an exported class merged with an exported interface',
      path: '/root/file.ts',
      text: 'export interface Foo {}\nexport class Foo {}',
      errors: [
        { message: 'Unsafe declaration merging between classes and interfaces.', line: 1, column: 18, endLine: 1, endColumn: 21 },
        { message: 'Unsafe declaration merging between classes and interfaces.', line: 2, column: 14, endLine: 2, endColumn: 17 },
      ],
    },
    {
      name: '#22 a declared abstract class merged with an interface',
      path: '/root/file.ts',
      text: 'declare abstract class Foo {}\ninterface Foo {}',
      errors: [
        { message: 'Unsafe declaration merging between classes and interfaces.', line: 1, column: 24, endLine: 1, endColumn: 27 },
        { message: 'Unsafe declaration merging between classes and interfaces.', line: 2, column: 11, endLine: 2, endColumn: 14 },
      ],
    },
    {
      name: '#26 a generic interface is looked up in its own type parameter scope, so only the class is reported',
      path: '/root/file.ts',
      text: 'interface Foo<T> {\n  a: T;\n}\nclass Foo<T> {}',
      errors: [{ message: 'Unsafe declaration merging between classes and interfaces.', line: 4, column: 7, endLine: 4, endColumn: 10 }],
    },
  ],
})
