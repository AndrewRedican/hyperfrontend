import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-self-assign.ts'

// why: the workspace runs the rule with its default options; the cases that switch property comparison off are left out.
testRule(rule, {
  valid: [
    { name: '#1 var a = a', path: '/root/file.ts', text: 'var a = a' },
    { name: '#3 a += a', path: '/root/file.ts', text: 'a += a' },
    { name: '#4 a = +a', path: '/root/file.ts', text: 'a = +a' },
    { name: '#8 let a = a', path: '/root/file.ts', text: 'let a = a' },
    { name: '#9 const a = a', path: '/root/file.ts', text: 'const a = a' },
    { name: '#11 [a = 1] = [a]', path: '/root/file.ts', text: '[a = 1] = [a]' },
    { name: '#13 [a,, b] = [, b, a]', path: '/root/file.ts', text: '[a,, b] = [, b, a]' },
    { name: '#16 [a, ...b] = [0, ...b, 1]', path: '/root/file.ts', text: '[a, ...b] = [0, ...b, 1]' },
    { name: '#19 ({a = 1} = {a})', path: '/root/file.ts', text: '({a = 1} = {a})' },
    { name: '#22 ({a} = {a() {}})', path: '/root/file.ts', text: '({a} = {a() {}})' },
    { name: '#23 ({a} = {[a]: a})', path: '/root/file.ts', text: '({a} = {[a]: a})' },
    { name: "#25 ({'foo': a, 1: a} = {'bar': a, 2: a})", path: '/root/file.ts', text: "({'foo': a, 1: a} = {'bar': a, 2: a})" },
    { name: '#26 ({a, ...b} = {a, ...b})', path: '/root/file.ts', text: '({a, ...b} = {a, ...b})' },
    { name: '#31 a.b().c = a.b().c', path: '/root/file.ts', text: 'a.b().c = a.b().c', options: { props: true } },
    { name: '#33 a.null = a[/(?<zero>0)/]', path: '/root/file.ts', text: 'a.null = a[/(?<zero>0)/]', options: { props: true } },
    { name: '#34 a[b + 1] = a[b + 1]', path: '/root/file.ts', text: 'a[b + 1] = a[b + 1]', options: { props: true } },
    {
      name: "#42 class C { #field; foo() { this['#field'] = this.#field; } }",
      path: '/root/file.ts',
      text: "class C { #field; foo() { this['#field'] = this.#field; } }",
    },
    {
      name: '#49 a getter on the right-hand object is not a self-assignment',
      path: '/root/file.ts',
      text: '({a} = {get a() { return 1 }})',
    },
    { name: '#59 a type-asserted right-hand side is a different node', path: '/root/file.ts', text: 'a = a as number' },
    { name: '#60 a non-null-asserted right-hand side is a different node', path: '/root/file.ts', text: 'a = a!' },
  ],
  invalid: [
    {
      name: '#66 [a, ...b] = [a, ...b]',
      path: '/root/file.ts',
      text: '[a, ...b] = [a, ...b]',
      errors: [
        { message: "'a' is assigned to itself.", line: 1, column: 14, endLine: 1, endColumn: 15 },
        { message: "'b' is assigned to itself.", line: 1, column: 20, endLine: 1, endColumn: 21 },
      ],
    },
    {
      name: "#77 ({'a': b} = {[`a`]: b})",
      path: '/root/file.ts',
      text: "({'a': b} = {[`a`]: b})",
      errors: [{ message: "'b' is assigned to itself.", line: 1, column: 21, endLine: 1, endColumn: 22 }],
    },
    {
      name: '#82 ({a: {b}, c: [d]} = {a: {b}, c: [d]})',
      path: '/root/file.ts',
      text: '({a: {b}, c: [d]} = {a: {b}, c: [d]})',
      errors: [
        { message: "'b' is assigned to itself.", line: 1, column: 26, endLine: 1, endColumn: 27 },
        { message: "'d' is assigned to itself.", line: 1, column: 34, endLine: 1, endColumn: 35 },
      ],
    },
    {
      name: '#88 a[',
      path: '/root/file.ts',
      text: "a[\n    'b'\n] = a[\n    'b'\n]",
      errors: [{ message: "'a['b']' is assigned to itself.", line: 3, column: 5, endLine: 5, endColumn: 2 }],
    },
    {
      name: '#96 (a?.b).c = (a?.b).c',
      path: '/root/file.ts',
      text: '(a?.b).c = (a?.b).c',
      errors: [{ message: "'(a?.b).c' is assigned to itself.", line: 1, column: 12, endLine: 1, endColumn: 20 }],
    },
  ],
})

testRule(rule, {
  valid: [{ name: 'a template key with a substitution', path: '/project/file.ts', text: '({[`a${b}`]: c} = {[`a${b}`]: c})' }],
  invalid: [
    {
      name: 'a super property',
      path: '/project/file.ts',
      text: 'class A extends B { m() { super.x = super.x } }',
      errors: [{ message: "'super.x' is assigned to itself.", line: 1, column: 37, endLine: 1, endColumn: 44 }],
    },
    {
      name: 'a bigint key',
      path: '/project/file.ts',
      text: 'a[1n] = a[1n]',
      errors: [{ message: "'a[1n]' is assigned to itself.", line: 1, column: 9, endLine: 1, endColumn: 14 }],
    },
  ],
})
