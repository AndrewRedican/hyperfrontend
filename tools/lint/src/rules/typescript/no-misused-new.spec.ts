import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-misused-new.ts'

testRule(rule, {
  valid: [
    {
      name: '#1 declare abstract class C {',
      path: '/root/file.ts',
      text: '\ndeclare abstract class C {\n  foo() {}\n  get new();\n  bar();\n}\n    ',
    },
    { name: '#8 const foo = class {', path: '/root/file.ts', text: '\nconst foo = class {\n  constructor() {}\n};\n    ' },
    { name: '#10 type T = { new (): T };', path: '/root/file.ts', text: 'type T = { new (): T };' },
    { name: '#11 export default class {', path: '/root/file.ts', text: '\nexport default class {\n  constructor();\n}\n    ' },
    { name: '#12 interface foo {', path: '/root/file.ts', text: '\ninterface foo {\n  new <T>(): bar<T>;\n}\n    ' },
    { name: '#13 interface foo {', path: '/root/file.ts', text: "\ninterface foo {\n  new <T>(): 'x';\n}\n    " },
    { name: '#16 a new method returning a qualified name', path: '/root/file.ts', text: 'class C {\n  new(): Ns.C;\n}' },
    { name: '#18 a computed new key is not a new method', path: '/root/file.ts', text: "class C {\n  ['new'](): C;\n}" },
    {
      name: '#19 an abstract new method is not a method definition',
      path: '/root/file.ts',
      text: 'abstract class C {\n  abstract new(): C;\n}',
    },
    { name: '#20 a construct signature without a return type', path: '/root/file.ts', text: 'interface I {\n  new ();\n}' },
    {
      name: '#23 a quoted constructor key is not a method named constructor',
      path: '/root/file.ts',
      text: "interface I {\n  'constructor'(): void;\n}",
    },
    { name: '#25 a class property named new', path: '/root/file.ts', text: 'class C {\n  new: () => C;\n}' },
  ],
  invalid: [
    {
      name: '#34 a static new method returning the class',
      path: '/root/file.ts',
      text: 'class C {\n  static new(): C;\n}',
      errors: [{ message: 'Class cannot have method named `new`.', line: 2, column: 3, endLine: 2, endColumn: 19 }],
    },
    {
      name: '#35 an exported class with a new method returning itself',
      path: '/root/file.ts',
      text: 'export class C {\n  new(): C;\n}',
      errors: [{ message: 'Class cannot have method named `new`.', line: 2, column: 3, endLine: 2, endColumn: 12 }],
    },
    {
      name: '#36 a construct signature in an interface of a declared namespace',
      path: '/root/file.ts',
      text: 'declare namespace N {\n  interface I {\n    new (): I;\n  }\n}',
      errors: [{ message: 'Interfaces cannot be constructed, only classes.', line: 3, column: 5, endLine: 3, endColumn: 15 }],
    },
    {
      name: '#38 a constructor method signature nested in a type literal',
      path: '/root/file.ts',
      text: 'type T = {\n  inner: {\n    constructor(): void;\n  };\n};',
      errors: [{ message: 'Interfaces cannot be constructed, only classes.', line: 3, column: 5, endLine: 3, endColumn: 25 }],
    },
    {
      name: '#39 a multi-line construct signature returning its interface',
      path: '/root/file.ts',
      text: 'interface I {\n  new (\n    a: string,\n  ): I;\n}',
      errors: [{ message: 'Interfaces cannot be constructed, only classes.', line: 2, column: 3, endLine: 4, endColumn: 8 }],
    },
    {
      name: '#40 a class and an interface reported in one file',
      path: '/root/file.ts',
      text: 'class C {\n  new(): C;\n}\ninterface I {\n  new (): I;\n}',
      errors: [
        { message: 'Class cannot have method named `new`.', line: 2, column: 3, endLine: 2, endColumn: 12 },
        { message: 'Interfaces cannot be constructed, only classes.', line: 5, column: 3, endLine: 5, endColumn: 13 },
      ],
    },
  ],
})
