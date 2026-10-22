import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-empty-function.ts'

// why: the workspace allows no kind of empty function; the cases recorded with an allowance are left out.
testRule(rule, {
  valid: [
    {
      name: '#1 class Person {',
      path: '/root/file.ts',
      text: '\nclass Person {\n  private name: string;\n  constructor(name: string) {\n    this.name = name;\n  }\n}\n      ',
    },
    { name: '#7 function foo() {', path: '/root/file.ts', text: '\nfunction foo() {\n  const a = null;\n}\n      ' },
    {
      name: '#10 a constructor with a parameter property among plain parameters',
      path: '/root/file.ts',
      text: 'class A {\n  constructor(a: string, public b: number) {}\n}',
    },
    {
      name: '#13 a method with a comment is not empty',
      path: '/root/file.ts',
      text: 'class A {\n  foo() {\n    // why: nothing yet\n  }\n}',
    },
    { name: '#25 an abstract method has no body', path: '/root/file.ts', text: 'abstract class A {\n  abstract m(): void;\n}' },
    {
      name: '#26 an overload signature has no body',
      path: '/root/file.ts',
      text: 'class A {\n  m(a: string): void;\n  m(a: number): void;\n  m(a: unknown) {\n    use(a);\n  }\n}',
    },
  ],
  invalid: [
    {
      name: '#31 class Foo {',
      path: '/root/file.ts',
      text: '\nclass Foo {\n  protected constructor() {}\n}\n      ',
      errors: [{ message: 'Unexpected empty constructor.', line: 3, column: 27, endLine: 3, endColumn: 29 }],
    },
    {
      name: '#32 function foo() {}',
      path: '/root/file.ts',
      text: '\nfunction foo() {}\n      ',
      errors: [{ message: "Unexpected empty function 'foo'.", line: 2, column: 16, endLine: 2, endColumn: 18 }],
    },
    {
      name: '#33 class Foo {',
      path: '/root/file.ts',
      text: '\nclass Foo {\n  @decorator()\n  foo() {}\n}\n      ',
      errors: [{ message: "Unexpected empty method 'foo'.", line: 4, column: 9, endLine: 4, endColumn: 11 }],
    },
    {
      name: '#34 class Foo extends Base {',
      path: '/root/file.ts',
      text: '\nclass Foo extends Base {\n  override foo() {}\n}\n      ',
      errors: [{ message: "Unexpected empty method 'foo'.", line: 3, column: 18, endLine: 3, endColumn: 20 }],
    },
    {
      name: '#42 an empty arrow function under the workspace defaults',
      path: '/root/file.ts',
      text: 'const f = () => {};',
      errors: [{ message: 'Unexpected empty arrow function.', line: 1, column: 17, endLine: 1, endColumn: 19 }],
    },
    {
      name: '#43 an empty static method under the workspace defaults',
      path: '/root/file.ts',
      text: 'class A {\n  static m() {}\n}',
      errors: [{ message: "Unexpected empty static method 'm'.", line: 2, column: 14, endLine: 2, endColumn: 16 }],
    },
    {
      name: '#44 an empty private method under the workspace defaults',
      path: '/root/file.ts',
      text: 'class A {\n  #m() {}\n}',
      errors: [{ message: 'Unexpected empty private method #m.', line: 2, column: 8, endLine: 2, endColumn: 10 }],
    },
    {
      name: '#45 an empty async arrow function under the workspace defaults',
      path: '/root/file.ts',
      text: 'const f = async () => {};',
      errors: [{ message: 'Unexpected empty async arrow function.', line: 1, column: 23, endLine: 1, endColumn: 25 }],
    },
    {
      name: '#46 an empty constructor with a parameter property is allowed while an empty method is reported',
      path: '/root/file.ts',
      text: 'class A {\n  constructor(private a: string) {}\n  m() {}\n}',
      errors: [{ message: "Unexpected empty method 'm'.", line: 3, column: 7, endLine: 3, endColumn: 9 }],
    },
    {
      name: '#47 an empty generator method under the workspace defaults',
      path: '/root/file.ts',
      text: 'class A {\n  *g() {}\n}',
      errors: [{ message: "Unexpected empty generator method 'g'.", line: 2, column: 8, endLine: 2, endColumn: 10 }],
    },
    {
      name: '#48 an empty getter and setter under the workspace defaults',
      path: '/root/file.ts',
      text: 'class A {\n  get a() {}\n  set a(v: string) {}\n}',
      errors: [
        { message: "Unexpected empty getter 'a'.", line: 2, column: 11, endLine: 2, endColumn: 13 },
        { message: "Unexpected empty setter 'a'.", line: 3, column: 20, endLine: 3, endColumn: 22 },
      ],
    },
  ],
})

const PATH = '/project/file.ts'

testRule(rule, {
  valid: [{ name: 'an arrow function with an expression body', path: PATH, text: 'const f = () => 1;' }],
  invalid: [
    {
      name: 'an empty object literal method, getter and function-valued property',
      path: PATH,
      text: 'const o = { m() {}, get a() {}, b: function () {} };',
      errors: [
        { message: "Unexpected empty method 'm'.", line: 1, column: 17 },
        { message: "Unexpected empty getter 'a'.", line: 1, column: 29 },
        { message: "Unexpected empty method 'b'.", line: 1, column: 48 },
      ],
    },
    {
      name: 'empty functions held by class fields',
      path: PATH,
      text: 'class A {\n  m = () => {};\n  static n = function named() {};\n}',
      errors: [
        { message: "Unexpected empty method 'm'.", line: 2, column: 13 },
        { message: "Unexpected empty static method 'n'.", line: 3, column: 31 },
      ],
    },
    {
      name: 'empty methods with computed, literal and template keys',
      path: PATH,
      text: 'class A {\n  [x]() {}\n  [1]() {}\n  "a b"() {}\n  [`t`]() {}\n  [/r/g]() {}\n  [a.b]() {}\n  [`${x}`]() {}\n}',
      errors: [
        { message: 'Unexpected empty method.', line: 2, column: 9 },
        { message: "Unexpected empty method '1'.", line: 3, column: 9 },
        { message: "Unexpected empty method 'a b'.", line: 4, column: 11 },
        { message: "Unexpected empty method 't'.", line: 5, column: 11 },
        { message: "Unexpected empty method '/r/g'.", line: 6, column: 12 },
        { message: 'Unexpected empty method.', line: 7, column: 11 },
        { message: 'Unexpected empty method.', line: 8, column: 14 },
      ],
    },
    {
      name: 'an unnamed empty function expression and a named one',
      path: PATH,
      text: 'const f = function () {};\nconst g = function named() {};',
      errors: [
        { message: 'Unexpected empty function.', line: 1, column: 23 },
        { message: "Unexpected empty function 'named'.", line: 2, column: 28 },
      ],
    },
  ],
})
