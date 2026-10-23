import { testRule } from '../../testing/rule-tester'
import rule from './no-unused-private-class-members'

testRule(rule, {
  valid: [
    {
      name: '#8 class C {',
      path: '/root/file.ts',
      text: 'class C {\n    #usedInOuterClass;\n\n    foo() {\n        return class {};\n    }\n\n    bar() {\n        return this.#usedInOuterClass;\n    }\n}',
    },
    {
      name: '#9 class Foo {',
      path: '/root/file.ts',
      text: 'class Foo {\n    #usedInForInLoop;\n    method() {\n        for (const bar in this.#usedInForInLoop) {\n\n        }\n    }\n}',
    },
    {
      name: '#11 class Foo {',
      path: '/root/file.ts',
      text: 'class Foo {\n    #usedInAssignmentPattern;\n    method() {\n        [bar = 1] = this.#usedInAssignmentPattern;\n    }\n}',
    },
    {
      name: '#15 class C {',
      path: '/root/file.ts',
      text: 'class C {\n    set #accessorWithSetterFirst(value) {\n        doSomething(value);\n    }\n    get #accessorWithSetterFirst() {\n        return something();\n    }\n    method() {\n        this.#accessorWithSetterFirst += 1;\n    }\n}',
    },
    { name: '#21 a private name outside any class is ignored', path: '/root/file.ts', text: 'function f() { return this.#x }' },
    {
      name: '#22 a private name no enclosing class declares is ignored',
      path: '/root/file.ts',
      text: 'class C { #x; m() { return this.#x + this.#y } }',
    },
    { name: '#33 the in operator reads the member', path: '/root/file.ts', text: 'class C { #x; static has(o) { return #x in o } }' },
    {
      name: '#34 an optional call of a private method is a read',
      path: '/root/file.ts',
      text: 'class C { #m() {} run() { this.#m?.() } }',
    },
    {
      name: '#36 a private method called inside a nested arrow function',
      path: '/root/file.ts',
      text: 'class C { #m() {} run() { return () => this.#m() } }',
    },
    {
      name: '#37 a nested class member of the same name does not hide the outer read',
      path: '/root/file.ts',
      text: 'class B { #z = 1; f() { class C { #z = 2; g() { return this.#z } } return [C, this.#z] } }',
    },
    { name: '#39 an optional member that is read', path: '/root/file.ts', text: 'class C { #x?: number; m() { return this.#x } }' },
    {
      name: '#40 public members and static blocks are not tracked',
      path: '/root/file.ts',
      text: 'class C { static { init() } x = 1; static y() {} [k] = 2 }',
    },
    { name: '#41 an auto-accessor is not tracked', path: '/root/file.ts', text: 'class C { accessor #x = 1 }' },
  ],
  invalid: [
    {
      name: '#65 a member only written through an object rest pattern is unused',
      path: '/root/file.ts',
      text: 'class C { #x; m() { ({ ...this.#x } = bar) } }',
      errors: [{ message: "'#x' is defined but never used.", line: 1, column: 11, endLine: 1, endColumn: 13 }],
    },
    {
      name: '#68 a member only decremented in a statement is unused',
      path: '/root/file.ts',
      text: 'class C { #x; m() { --this.#x } }',
      errors: [{ message: "'#x' is defined but never used.", line: 1, column: 11, endLine: 1, endColumn: 13 }],
    },
    {
      name: '#72 an unused member with a type annotation',
      path: '/root/file.ts',
      text: 'class C { #x: number | undefined }',
      errors: [{ message: "'#x' is defined but never used.", line: 1, column: 11, endLine: 1, endColumn: 13 }],
    },
    {
      name: '#74 every kind of write-only use leaves the members unused',
      path: '/root/file.ts',
      text: 'class A {\n  #a = 1\n  #b = 2\n  #c = 3\n  #d = 4\n  #e = 5\n  #f = 6\n  #g = 7\n  #h = 8\n  #i = 9\n  #j = 0\n  run(bar, foo) {\n    this.#a = 5\n    this.#b += 1\n    const x = (this.#c += 1)\n    this.#d++\n    ;({ x: this.#e } = bar)\n    ;({ [this.#f]: foo } = bar)\n    ;[...this.#g] = bar\n    ;[this.#h] = bar\n    for (this.#i in bar) {}\n    for (this.#j of bar) {}\n    return x\n  }\n}',
      errors: [
        { message: "'#a' is defined but never used.", line: 2, column: 3, endLine: 2, endColumn: 5 },
        { message: "'#b' is defined but never used.", line: 3, column: 3, endLine: 3, endColumn: 5 },
        { message: "'#d' is defined but never used.", line: 5, column: 3, endLine: 5, endColumn: 5 },
        { message: "'#e' is defined but never used.", line: 6, column: 3, endLine: 6, endColumn: 5 },
        { message: "'#g' is defined but never used.", line: 8, column: 3, endLine: 8, endColumn: 5 },
        { message: "'#h' is defined but never used.", line: 9, column: 3, endLine: 9, endColumn: 5 },
        { message: "'#i' is defined but never used.", line: 10, column: 3, endLine: 10, endColumn: 5 },
        { message: "'#j' is defined but never used.", line: 11, column: 3, endLine: 11, endColumn: 5 },
      ],
    },
    {
      name: '#75 the members of sibling classes are reported in declaration order',
      path: '/root/file.ts',
      text: 'class A { #a; #b }\nclass B { #c }',
      errors: [
        { message: "'#a' is defined but never used.", line: 1, column: 11, endLine: 1, endColumn: 13 },
        { message: "'#b' is defined but never used.", line: 1, column: 15, endLine: 1, endColumn: 17 },
        { message: "'#c' is defined but never used.", line: 2, column: 11, endLine: 2, endColumn: 13 },
      ],
    },
  ],
})
