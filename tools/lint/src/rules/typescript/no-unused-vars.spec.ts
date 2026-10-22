import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-unused-vars.ts'

// why: the workspace runs the rule with the upstream defaults and no import autofix, and this linter reads no `global`, `exported` or rule-tester comment directives; those cases are left out.
testRule(rule, {
  valid: [
    {
      name: '#192 var foo = 5;',
      path: '/root/file.ts',
      text: '\nvar foo = 5;\n\nlabel: while (true) {\n  console.log(foo);\n  break label;\n}\n    ',
    },
    {
      name: '#193 var foo = 5;',
      path: '/root/file.ts',
      text: '\nvar foo = 5;\n\nwhile (true) {\n  console.log(foo);\n  break;\n}\n    ',
    },
    {
      name: '#194 for (let prop in box) {',
      path: '/root/file.ts',
      text: '\nfor (let prop in box) {\n  box[prop] = parseInt(box[prop]);\n}\n      ',
    },
    { name: '#196 f({', path: '/root/file.ts', text: '\nf({\n  set foo(a) {\n    return;\n  },\n});\n    ' },
    { name: '#211 myFunc(function foo() {}.bind(this));', path: '/root/file.ts', text: 'myFunc(function foo() {}.bind(this));' },
    { name: '#224 ', path: '/root/file.ts', text: ' ', language: { globals: { a: 'writable' } } },
    { name: "#225 var who = 'Paul';", path: '/root/file.ts', text: "\nvar who = 'Paul';\nmodule.exports = `Hello ${who}!`;\n      " },
    {
      name: "#231 const foo = 'hello!';",
      path: '/root/file.ts',
      text: "\nconst foo = 'hello!';\nfunction bar(foobar = foo) {\n  foobar.replace(/!$/, ' world!');\n}\nbar();\n      ",
    },
    { name: '#240 const x = 1;', path: '/root/file.ts', text: '\nconst x = 1;\nconst { y = x } = {};\nfoo(y);\n      ' },
    { name: '#244 const x = 1;', path: '/root/file.ts', text: '\nconst x = 1;\nlet y;\n({\n  z: [y = x],\n} = {});\nfoo(y);\n      ' },
    {
      name: '#297 (function (iter) {',
      path: '/root/file.ts',
      text: '\n(function (iter) {\n  for (const name of iter) return true;\n})({});\n      ',
    },
    {
      name: '#315 var _timer;',
      path: '/root/file.ts',
      text: '\nvar _timer;\nfunction f() {\n  _timer = setTimeout(function () {}, _timer ? 100 : 0);\n}\nf();\n    ',
    },
    {
      name: '#316 function foo(cb) {',
      path: '/root/file.ts',
      text: '\nfunction foo(cb) {\n  cb = (function () {\n    function something(a) {\n      cb(1 + a);\n    }\n    register(something);\n  })();\n}\nfoo();\n    ',
    },
    {
      name: '#317 function* foo(cb) {',
      path: '/root/file.ts',
      text: '\nfunction* foo(cb) {\n  cb = yield function (a) {\n    cb(1 + a);\n  };\n}\nfoo();\n      ',
    },
    {
      name: '#318 function foo(cb) {',
      path: '/root/file.ts',
      text: '\nfunction foo(cb) {\n  cb = tag`hello${function (a) {\n    cb(1 + a);\n  }}`;\n}\nfoo();\n      ',
    },
    {
      name: '#319 function foo(cb) {',
      path: '/root/file.ts',
      text: '\nfunction foo(cb) {\n  var b;\n  cb = b = function (a) {\n    cb(1 + a);\n  };\n  b();\n}\nfoo();\n    ',
    },
    {
      name: '#320 function someFunction() {',
      path: '/root/file.ts',
      text: '\nfunction someFunction() {\n  var a = 0,\n    i;\n  for (i = 0; i < 2; i++) {\n    a = myFunction(a);\n  }\n}\nsomeFunction();\n    ',
    },
    { name: '#325 (class {', path: '/root/file.ts', text: '\n(class {\n  set foo(UNUSED) {}\n});\n      ' },
    { name: "#334 export * as ns from 'source';", path: '/root/file.ts', text: "export * as ns from 'source';" },
    { name: '#335 import.meta;', path: '/root/file.ts', text: 'import.meta;' },
    {
      name: '#472 enum FormFieldIds {',
      path: '/root/file.ts',
      text: "\nenum FormFieldIds {\n  PHONE = 'phone',\n  EMAIL = 'email',\n}\nexport interface IFoo {\n  fieldName: FormFieldIds.EMAIL;\n}\n    ",
    },
    {
      name: "#477 import { TypeA } from './interface';",
      path: '/root/react.tsx',
      text: "\nimport { TypeA } from './interface';\nexport const a = <GenericComponent<TypeA> />;\n      ",
    },
    {
      name: "#478 const text = 'text';",
      path: '/root/react.tsx',
      text: '\nconst text = \'text\';\nexport function Foo() {\n  return (\n    <div>\n      <input type="search" size={30} placeholder={text} />\n    </div>\n  );\n}\n      ',
    },
    {
      name: "#480 import { Dec, TypeA, Class } from 'test';",
      path: '/root/file.ts',
      text: "\nimport { Dec, TypeA, Class } from 'test';\nexport default class Foo {\n  constructor(\n    @Dec(Class)\n    private readonly prop: TypeA<Class>,\n  ) {}\n}\n    ",
    },
    {
      name: "#481 import { Dec, TypeA, Class } from 'test';",
      path: '/root/file.ts',
      text: "\nimport { Dec, TypeA, Class } from 'test';\nexport default class Foo {\n  constructor(\n    @Dec(Class)\n    ...prop: TypeA<Class>\n  ) {\n    prop();\n  }\n}\n    ",
    },
    {
      name: '#484 export function foo<T>(a: number): T;',
      path: '/root/file.ts',
      text: '\nexport function foo<T>(a: number): T;\nexport function foo<T>(a: string): T;\nexport function foo<T>(a: number | string): T {\n  return a;\n}\n    ',
    },
    {
      name: '#485 export type T = {',
      path: '/root/file.ts',
      text: '\nexport type T = {\n  new (): T;\n  new (arg: number): T;\n  new <T>(arg: number): T;\n};\n    ',
    },
    {
      name: '#486 export type T = new () => T;',
      path: '/root/file.ts',
      text: '\nexport type T = new () => T;\nexport type T = new (arg: number) => T;\nexport type T = new <T>(arg: number) => T;\n    ',
    },
    { name: '#487 enum Foo {', path: '/root/file.ts', text: '\nenum Foo {\n  a,\n}\nexport type T = {\n  [Foo.a]: 1;\n};\n    ' },
    {
      name: '#488 type Foo = string;',
      path: '/root/file.ts',
      text: '\ntype Foo = string;\nexport class Bar {\n  [x: Foo]: any;\n}\n    ',
    },
    {
      name: '#492 namespace foo.bar {',
      path: '/root/file.ts',
      text: '\nnamespace foo.bar {\n  export interface User {\n    name: string;\n  }\n}\n    ',
    },
    {
      name: '#498 type Foo = {',
      path: '/root/file.ts',
      text: '\ntype Foo = {\n  error: Error | null;\n};\n\nexport function foo() {\n  return new Promise<Foo>();\n}\n    ',
    },
    {
      name: '#499 export function foo<T>(value: T): T {',
      path: '/root/file.ts',
      text: '\nexport function foo<T>(value: T): T {\n  return { value };\n}\nexport type Foo<T> = typeof foo<T>;\n    ',
    },
    {
      name: "#502 import { FooType } from './fileA';",
      path: '/root/file.ts',
      text: "\nimport { FooType } from './fileA';\n\nexport abstract class Foo {\n  protected abstract readonly type: FooType;\n}\n    ",
    },
    {
      name: '#503 export type F<A extends unknown[]> = (...a: A) => unknown;',
      path: '/root/file.ts',
      text: '\nexport type F<A extends unknown[]> = (...a: A) => unknown;\n    ',
    },
    {
      name: '#505 type StyledPaymentProps = {',
      path: '/root/file.ts',
      text: '\ntype StyledPaymentProps = {\n  isValid: boolean;\n};\n\nexport const StyledPayment = styled.div<StyledPaymentProps>``;\n    ',
    },
    {
      name: "#506 import type { foo } from './a';",
      path: '/root/file.ts',
      text: "\nimport type { foo } from './a';\nexport type Bar = typeof foo;\n    ",
    },
    {
      name: '#507 interface Foo {}',
      path: '/root/foo.d.ts',
      text: '\ninterface Foo {}\ntype Bar = {};\ndeclare class Clazz {}\ndeclare function func();\ndeclare enum Enum {}\ndeclare namespace Name {}\ndeclare const v1;\ndeclare var v2;\ndeclare let v3;\ndeclare const { v4 };\ndeclare const { v4: v5 };\ndeclare const [v6];\n      ',
    },
    {
      name: '#509 export type Test<U> = U extends { [k: string]: infer I } ? I…',
      path: '/root/file.ts',
      text: '\nexport type Test<U> = U extends { [k: string]: infer I } ? I : never;\n    ',
    },
    {
      name: '#510 export type Test<U> = U extends (arg: {',
      path: '/root/file.ts',
      text: '\nexport type Test<U> = U extends (arg: {\n  [k: string]: (arg2: infer I) => void;\n}) => void\n  ? I\n  : never;\n    ',
    },
    {
      name: "#513 import { Fragment } from 'react';",
      path: '/root/react.tsx',
      text: "\n        import { Fragment } from 'react';\n\n        export const ComponentFoo: Fragment = () => {\n          return <>Foo Foo</>;\n        };\n      ",
      language: { jsxFragmentName: 'Fragment' },
    },
    {
      name: '#517 declare global {',
      path: '/root/file.ts',
      text: '\ndeclare global {\n  namespace jest {\n    interface Matchers<R> {\n      toBeSeven: () => R;\n    }\n  }\n}\n    ',
    },
    {
      name: '#519 class Foo<T> {',
      path: '/root/file.ts',
      text: '\nclass Foo<T> {\n  value: T;\n}\nclass Bar<T> {\n  foo = Foo<T>;\n}\nnew Bar();\n    ',
    },
    {
      name: '#523 type VerticalAlignment = "top" | "middle" | "bottom";',
      path: '/root/file.ts',
      text: '\ntype VerticalAlignment = "top" | "middle" | "bottom";\ntype HorizontalAlignment = "left" | "center" | "right";\n\nexport declare function setAlignment(value: `${VerticalAlignment}-${HorizontalAlignment}`): void;\n      ',
    },
    {
      name: '#528 /* lint @rule-tester/collect-unused-vars: "error" */',
      path: '/root/file.ts',
      text: '\n/* lint @rule-tester/collect-unused-vars: "error" */\ndeclare module \'next-auth\' {\n  interface User {\n    id: string;\n    givenName: string;\n    familyName: string;\n  }\n}\n    ',
    },
    {
      name: "#529 import { TestGeneric, Test } from 'fake-module';",
      path: '/root/file.ts',
      text: "\nimport { TestGeneric, Test } from 'fake-module';\n\ndeclare function deco(..._param: any): any;\nexport class TestClass {\n  @deco\n  public test(): TestGeneric<Test> {}\n}\n      ",
    },
    { name: '#541 type Foo = 1;', path: '/root/file.ts', text: '\ntype Foo = 1;\nexport = {} as Foo;\n    ' },
    {
      name: '#550 const command = (): ParameterDecorator => {',
      path: '/root/file.ts',
      text: '\nconst command = (): ParameterDecorator => {\n  return () => {};\n};\n\nexport class Foo {\n  bar(@command() command: string) {\n    console.log(command);\n  }\n}\n    ',
    },
    {
      name: '#554 export namespace Foo {',
      path: '/root/foo.d.ts',
      text: '\nexport namespace Foo {\n  export import Bar = Something.Bar;\n  const foo: 1234;\n}\n      ',
    },
    {
      name: "#568 import { ClassDecoratorFactory } from 'decorators';",
      path: '/root/file.ts',
      text: "\nimport { ClassDecoratorFactory } from 'decorators';\n@ClassDecoratorFactory()\nexport class Foo {}\n    ",
    },
    {
      name: "#579 import { configurable } from 'decorators';",
      path: '/root/file.ts',
      text: "\nimport { configurable } from 'decorators';\nexport class A {\n  @configurable(true) static prop1;\n\n  @configurable(false)\n  static prop2;\n}\n    ",
    },
    {
      name: "#584 import { Foo } from 'foo';",
      path: '/root/file.ts',
      text: "\nimport { Foo } from 'foo';\nconst bar = function <T>(): T {};\nbar<Foo>();\n    ",
    },
    {
      name: "#586 import { Foo } from 'foo';",
      path: '/root/file.ts',
      text: "\nimport { Foo } from 'foo';\n<Foo>(<T,>(): T => {})();\n    ",
    },
    {
      name: "#592 import { Nullable } from 'nullable';",
      path: '/root/file.ts',
      text: "\nimport { Nullable } from 'nullable';\nimport { SomeOther } from 'other';\nconst a: Nullable<Array<SomeOther>> = 'hello';\nconsole.log(a);\n    ",
    },
    {
      name: "#599 import { Nullable } from 'nullable';",
      path: '/root/file.ts',
      text: "\nimport { Nullable } from 'nullable';\nimport { Component } from 'react';\nclass Foo extends Component<Nullable, {}> {}\nnew Foo();\n    ",
    },
    {
      name: "#613 import { Nullable } from 'nullable';",
      path: '/root/file.ts',
      text: "\nimport { Nullable } from 'nullable';\nimport { SomeOther } from 'some';\nimport { Another } from 'some';\nexport interface A extends Nullable<SomeOther> {\n  do(a: Nullable<Another>);\n}\n    ",
    },
    {
      name: "#616 import { Foo } from './types';",
      path: '/root/file.ts',
      text: "\nimport { Foo } from './types';\n\nclass Bar<T = Foo> {\n  prop: T;\n}\n\nnew Bar<number>();\n    ",
    },
    {
      name: "#620 type Foo = 'a' | 'b' | 'c';",
      path: '/root/file.ts',
      text: "\ntype Foo = 'a' | 'b' | 'c';\ntype Bar = number;\n\nexport const map: { [name in Foo]: Bar } = {\n  a: 1,\n  b: 2,\n  c: 3,\n};\n    ",
    },
    {
      name: "#621 type Foo = 'a' | 'b' | 'c';",
      path: '/root/file.ts',
      text: "\ntype Foo = 'a' | 'b' | 'c';\ntype Bar = number;\n\nexport const map: { [name in Foo as string]: Bar } = {\n  a: 1,\n  b: 2,\n  c: 3,\n};\n    ",
    },
    {
      name: '#627 export class App {',
      path: '/root/file.ts',
      text: '\nexport class App {\n  constructor(bar: string);\n  constructor(private logger: Logger) {\n    console.log(this.logger);\n  }\n}\n    ',
    },
    {
      name: "#631 import { Component, Vue } from 'vue-property-decorator';",
      path: '/root/file.ts',
      text: "\nimport { Component, Vue } from 'vue-property-decorator';\nimport HelloWorld from './components/HelloWorld.vue';\n\n@Component({\n  components: {\n    HelloWorld,\n  },\n})\nexport default class App extends Vue {}\n    ",
    },
    {
      name: "#634 import webpack from 'webpack';",
      path: '/root/file.ts',
      text: "\nimport webpack from 'webpack';\nexport default function webpackLoader(this: webpack.loader.LoaderContext) {}\n    ",
    },
    {
      name: "#635 import execa, { Options as ExecaOptions } from 'execa';",
      path: '/root/file.ts',
      text: "\nimport execa, { Options as ExecaOptions } from 'execa';\nexport function foo(options: ExecaOptions): execa {\n  options();\n}\n    ",
    },
  ],
  invalid: [
    {
      name: '#20 an unused namespace import is a declaration-removal suggestion under the workspace defaults',
      path: '/root/file.ts',
      text: "import * as Unused from 'module';\nexport {};",
      errors: [{ message: "'Unused' is defined but never used.", line: 1, column: 13, endLine: 1, endColumn: 19 }],
    },
    {
      name: '#25 an unused import-equals declaration is a declaration-removal suggestion',
      path: '/root/file.ts',
      text: "import Unused = require('module');\nexport {};",
      errors: [{ message: "'Unused' is defined but never used.", line: 1, column: 8, endLine: 1, endColumn: 14 }],
    },
    {
      name: '#33 try {',
      path: '/root/file.ts',
      text: '\ntry {\n} catch (err) {}\n      ',
      options: { caughtErrors: 'all' },
      errors: [{ message: "'err' is defined but never used.", line: 3, column: 10, endLine: 3, endColumn: 13 }],
    },
    {
      name: '#51 function foo(cb) {',
      path: '/root/file.ts',
      text: '\nfunction foo(cb) {\n  cb = (function (a) {\n    return cb(1 + a);\n  })();\n}\nfoo();\n      ',
      errors: [{ message: "'cb' is assigned a value but never used.", line: 3, column: 3, endLine: 3, endColumn: 5 }],
    },
    {
      name: '#52 function foo(cb) {',
      path: '/root/file.ts',
      text: '\nfunction foo(cb) {\n  cb =\n    (function (a) {\n      cb(1 + a);\n    },\n    cb);\n}\nfoo();\n      ',
      errors: [{ message: "'cb' is assigned a value but never used.", line: 3, column: 3, endLine: 3, endColumn: 5 }],
    },
    {
      name: '#53 function foo(cb) {',
      path: '/root/file.ts',
      text: '\nfunction foo(cb) {\n  cb =\n    (0,\n    function (a) {\n      cb(1 + a);\n    });\n}\nfoo();\n      ',
      errors: [{ message: "'cb' is assigned a value but never used.", line: 3, column: 3, endLine: 3, endColumn: 5 }],
    },
    {
      name: '#70 let x = 0;',
      path: '/root/file.ts',
      text: '\nlet x = 0;\n(0, (x += 1));\n      ',
      errors: [{ message: "'x' is assigned a value but never used.", line: 3, column: 6, endLine: 3, endColumn: 7 }],
    },
    {
      name: '#84 (function ([a], [b, c]) {',
      path: '/root/file.ts',
      text: '\n(function ([a], [b, c]) {\n  return b;\n})();\n      ',
      errors: [
        { message: "'a' is defined but never used.", line: 2, column: 13, endLine: 2, endColumn: 14 },
        { message: "'c' is defined but never used.", line: 2, column: 21, endLine: 2, endColumn: 22 },
      ],
    },
    {
      name: '#91 let myArray = [1, 2, 3, 4].filter(x => x == 0);',
      path: '/root/file.ts',
      text: '\nlet myArray = [1, 2, 3, 4].filter(x => x == 0);\nmyArray = myArray.filter(x => x == 1);\n      ',
      errors: [{ message: "'myArray' is assigned a value but never used.", line: 3, column: 1, endLine: 3, endColumn: 8 }],
    },
    {
      name: '#97 function foo(n) {',
      path: '/root/file.ts',
      text: '\nfunction foo(n) {\n  if (n < 2) return 1;\n  return n * foo(n - 1);\n}\n      ',
      errors: [{ message: "'foo' is defined but never used.", line: 2, column: 10, endLine: 2, endColumn: 13 }],
    },
    {
      name: '#121 function f() {',
      path: '/root/file.ts',
      text: '\nfunction f() {\n  var a = 1;\n  return function () {\n    f(++a);\n  };\n}\n      ',
      errors: [{ message: "'f' is defined but never used.", line: 2, column: 10, endLine: 2, endColumn: 11 }],
    },
    {
      name: '#128 var a = 10,',
      path: '/root/file.ts',
      text: '\nvar a = 10,\n  b = 0,\n  c = null;\nsetTimeout(function () {\n  var b = 2;\n  alert(a + b + c);\n}, 0);\n      ',
      options: 'all',
      errors: [{ message: "'b' is assigned a value but never used.", line: 3, column: 3, endLine: 3, endColumn: 4 }],
    },
    {
      name: '#163 (function (obj) {',
      path: '/root/file.ts',
      text: '\n(function (obj) {\n  var name;\n  for (name in obj) {\n    i();\n    return;\n  }\n})({});\n      ',
      errors: [{ message: "'name' is assigned a value but never used.", line: 4, column: 8, endLine: 4, endColumn: 12 }],
    },
    {
      name: "#171 const data = { type: 'coords', x: 1, y: 2 };",
      path: '/root/file.ts',
      text: "\nconst data = { type: 'coords', x: 1, y: 2 };\nconst { type, ...coords } = data;\nconsole.log(coords);\n      ",
      errors: [{ message: "'type' is assigned a value but never used.", line: 3, column: 9, endLine: 3, endColumn: 13 }],
    },
    {
      name: '#185 export default function (a) {}',
      path: '/root/file.ts',
      text: 'export default function (a) {}',
      errors: [{ message: "'a' is defined but never used.", line: 1, column: 26, endLine: 1, endColumn: 27 }],
    },
    {
      name: '#373 a global variable of a script when all variables are checked',
      path: '/root/file.ts',
      text: 'var a = 1;',
      options: 'all',
      language: { sourceType: 'script' },
      errors: [{ message: "'a' is assigned a value but never used.", line: 1, column: 5, endLine: 1, endColumn: 6 }],
    },
    {
      name: '#382 a class with a static block when such classes are not ignored',
      path: '/root/file.ts',
      text: 'class A {\n  static {\n    init();\n  }\n}',
      errors: [{ message: "'A' is defined but never used.", line: 1, column: 7, endLine: 1, endColumn: 8 }],
    },
    {
      name: '#384 a using declaration when those are not ignored',
      path: '/root/file.ts',
      text: 'using resource = getResource();',
      errors: [{ message: "'resource' is assigned a value but never used.", line: 1, column: 7, endLine: 1, endColumn: 15 }],
    },
    {
      name: "#393 import { Foo, Bar } from 'foo';",
      path: '/root/file.ts',
      text: "\nimport { Foo, Bar } from 'foo';\nfunction baz<Foo>(): Foo {}\nbaz<Bar>();\n      ",
      errors: [{ message: "'Foo' is defined but never used.", line: 2, column: 10, endLine: 2, endColumn: 13 }],
    },
    {
      name: "#407 import test from 'test';",
      path: '/root/file.ts',
      text: "\nimport test from 'test';\nimport baz from 'baz';\nexport class Bar implements baz.test {}\n      ",
      errors: [{ message: "'test' is defined but never used.", line: 2, column: 8, endLine: 2, endColumn: 12 }],
    },
    {
      name: '#413 interface Foo {',
      path: '/root/file.ts',
      text: "\ninterface Foo {\n  bar: string;\n  baz: Foo['bar'];\n}\n      ",
      errors: [{ message: "'Foo' is defined but never used.", line: 2, column: 11, endLine: 2, endColumn: 14 }],
    },
    {
      name: "#415 import React from 'react';",
      path: '/root/react.tsx',
      text: "\nimport React from 'react';\nimport { Fragment } from 'react';\n\nexport const ComponentFoo = () => {\n  return <div>Foo Foo</div>;\n};\n      ",
      errors: [{ message: "'Fragment' is defined but never used.", line: 3, column: 10, endLine: 3, endColumn: 18 }],
    },
    {
      name: "#417 import React from 'react';",
      path: '/root/react.tsx',
      text: "\nimport React from 'react';\n\nexport const ComponentFoo = () => {\n  return <div>Foo Foo</div>;\n};\n      ",
      language: { jsxPragma: null },
      errors: [{ message: "'React' is defined but never used.", line: 2, column: 8, endLine: 2, endColumn: 13 }],
    },
    {
      name: "#418 declare module 'foo' {",
      path: '/root/file.ts',
      text: "\ndeclare module 'foo' {\n  type Test = any;\n  const x = 1;\n  export = x;\n}\n      ",
      errors: [{ message: "'Test' is defined but never used.", line: 3, column: 8, endLine: 3, endColumn: 12 }],
    },
    {
      name: '#419 // not declared',
      path: '/root/file.ts',
      text: '\n// not declared\nexport namespace Foo {\n  namespace Bar {\n    namespace Baz {\n      namespace Bam {\n        const x = 1;\n      }\n    }\n  }\n}\n      ',
      errors: [
        { message: "'Bar' is defined but never used.", line: 4, column: 13, endLine: 4, endColumn: 16 },
        { message: "'Baz' is defined but never used.", line: 5, column: 15, endLine: 5, endColumn: 18 },
        { message: "'Bam' is defined but never used.", line: 6, column: 17, endLine: 6, endColumn: 20 },
        { message: "'x' is assigned a value but never used.", line: 7, column: 15, endLine: 7, endColumn: 16 },
      ],
    },
    {
      name: '#434 declare const foo: number;',
      path: '/root/file.ts',
      text: '\n        declare const foo: number;\n\n        export type Foo = typeof foo;\n      ',
      errors: [{ message: "'foo' is defined but only used as a type.", line: 2, column: 23, endLine: 2, endColumn: 26 }],
    },
    {
      name: '#436 const foo: number = 1;',
      path: '/root/file.ts',
      text: "\n        const foo: number = 1;\n\n        export type Foo = (typeof foo | string) & { __brand: 'foo' };\n      ",
      errors: [{ message: "'foo' is assigned a value but only used as a type.", line: 2, column: 15, endLine: 2, endColumn: 18 }],
    },
    {
      name: '#440 declare const deco: () => ParameterDecorator;',
      path: '/root/file.ts',
      text: '\ndeclare const deco: () => ParameterDecorator;\n\nexport class Foo {\n  bar(@deco() deco, @deco() param) {}\n}\n      ',
      errors: [
        { message: "'deco' is defined but never used.", line: 5, column: 15, endLine: 5, endColumn: 19 },
        { message: "'param' is defined but never used.", line: 5, column: 29, endLine: 5, endColumn: 34 },
      ],
    },
    {
      name: "#446 declare module 'foo' {",
      path: '/root/foo.d.ts',
      text: "\ndeclare module 'foo' {\n  const foo: 1234;\n  const bar: 4567;\n\n  export { bar };\n}\n      ",
      errors: [{ message: "'foo' is defined but never used.", line: 3, column: 9, endLine: 3, endColumn: 12 }],
    },
    {
      name: '#450 export namespace Foo {',
      path: '/root/foo.d.ts',
      text: '\nexport namespace Foo {\n  const foo: string;\n  const bar: number;\n\n  export default bar;\n}\n      ',
      errors: [{ message: "'foo' is defined but never used.", line: 3, column: 9, endLine: 3, endColumn: 12 }],
    },
    {
      name: '#456 export namespace Foo {',
      path: '/root/foo.d.ts',
      text: "\nexport namespace Foo {\n  const foo: string;\n  export const bar: number;\n\n  export * from '...';\n}\n      ",
      errors: [{ message: "'foo' is defined but never used.", line: 3, column: 9, endLine: 3, endColumn: 12 }],
    },
    {
      name: '#469 await using resource = getResource();',
      path: '/root/file.ts',
      text: '\nawait using resource = getResource();\n      ',
      errors: [{ message: "'resource' is assigned a value but never used.", line: 2, column: 13, endLine: 2, endColumn: 21 }],
    },
  ],
})

testRule(rule, {
  valid: [
    {
      name: 'a parameter property with a default',
      path: '/w/a.ts',
      text: 'export class A {\n  constructor(private x = 1) {\n    console.log(this.x);\n  }\n}\n',
    },
    {
      name: 'a callback stored through a declaration inside the call assigned to it',
      path: '/w/a.ts',
      text: 'function foo(cb) {\n  cb = (function () {\n    const g = function (a) {\n      cb(1 + a);\n    };\n    register(g);\n  })();\n}\nfoo();\n',
    },
    {
      name: 'a type referenced before its declaration',
      path: '/w/a.ts',
      text: 'export function f(): T {\n  return 1;\n}\ntype T = 1;\n',
    },
  ],
  invalid: [],
})
