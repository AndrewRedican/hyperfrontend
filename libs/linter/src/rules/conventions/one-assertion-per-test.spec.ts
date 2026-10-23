import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { testRule } from '../../testing/rule-tester'
import rule from './one-assertion-per-test'

// why: some cases lint a file that must exist on disk, so the fixture is a disposable directory in the temporary directory.
const ROOT = mkdtempSync(join(tmpdir(), 'lint-one-assertion-'))
const WORKSPACE = join(ROOT, 'workspace')
const SPEC = join(WORKSPACE, 'libs', 'demo', 'src', 'demo.spec.ts')
mkdirSync(join(WORKSPACE, 'libs', 'demo', 'src'), { recursive: true })

const message = (where: string): string =>
  `A test body asserts one behaviour, but this one holds 2 assertions (${where}). Split it into focused tests, each named for the single behaviour it asserts; when the checks jointly describe one indivisible behaviour, fold them into one assertion with a composite or asymmetric matcher such as expect.objectContaining.`

testRule(rule, {
  valid: [
    {
      name: '#5 does not count asymmetric matchers as assertions',
      path: '/root/file.ts',
      text: "it('x', () => {\n  expect(result).toEqual({\n    id: expect.any(String),\n    items: expect.arrayContaining([expect.objectContaining({ name: 'a' })]),\n    text: expect.stringContaining('ok'),\n    note: expect.not.stringMatching(/x/),\n    value: expect.closeTo(1, 2),\n    other: expect.anything(),\n  })\n})",
    },
    {
      name: '#6 does not count a computed member on expect',
      path: '/root/file.ts',
      text: "it('x', () => { expect(a).toBe(1); expect['any'](Number) })",
    },
    {
      name: '#12 allows one assertion in a function expression body',
      path: '/root/file.ts',
      text: "it('x', function () { expect(a).toBe(1) })",
    },
    {
      name: '#26 allows it.each with one assertion per row',
      path: '/root/file.ts',
      text: "it.each([[1, 2, 3]])('adds %s and %s', (a, b, sum) => { expect(a + b).toBe(sum) })",
    },
    {
      name: '#27 allows a tagged-template it.each with one assertion',
      path: '/root/file.ts',
      text: "it.each`\n  a | b\n  ${1} | ${2}\n`('adds $a', ({ a, b }) => { expect(a + b).toBe(3) })",
    },
    {
      name: '#32 ignores a sequence expression callee',
      path: '/root/file.ts',
      text: "(0, it)('x', () => { expect(a).toBe(1); expect(b).toBe(2) })",
    },
    {
      name: '#33 ignores a foreign tagged template',
      path: '/root/file.ts',
      text: "tag`table`('x', () => { expect(a).toBe(1); expect(b).toBe(2) })",
    },
    {
      name: '#34 ignores a foreign each',
      path: '/root/file.ts',
      text: "foo.each([1])('x', () => { expect(a).toBe(1); expect(b).toBe(2) })",
    },
    {
      name: '#37 does not count assertions in a nested test',
      path: '/root/file.ts',
      text: "it('outer', () => {\n  expect(a).toBe(1)\n  it('inner', () => { expect(b).toBe(2) })\n})",
    },
    {
      name: '#43 counts a local function declaration through its references',
      path: '/root/file.ts',
      text: "it('x', () => {\n  function check(value) { expect(value).toBe(1) }\n  check(a)\n})",
    },
    {
      name: '#44 does not count a helper without assertions',
      path: '/root/file.ts',
      text: "const make = () => ({ a: 1 })\nit('x', () => { expect(make()).toEqual({ a: 1 }) })",
    },
    {
      name: '#47 does not count a default import called as a helper',
      path: '/root/file.ts',
      text: "import check from './helpers'\nit('x', () => { check(result); expect(a).toBe(1) })",
    },
    {
      name: '#49 does not count a variable declared without a value',
      path: '/root/file.ts',
      text: "let check\nit('x', () => { check(a); expect(b).toBe(1) })",
    },
    {
      name: '#51 does not count a declared function without a body',
      path: '/root/file.ts',
      text: "declare function check(value: unknown): void\nit('x', () => { check(a); expect(b).toBe(1) })",
    },
    {
      name: '#53 ignores a destructuring declarator',
      path: '/root/file.ts',
      text: "it('x', () => { const { a } = make(); const [, b] = pair; expect(a).toBe(b) })",
    },
    { name: '#55 reads a body passed by name', path: '/root/file.ts', text: "function body() { expect(a).toBe(1) }\nit('x', body)" },
    { name: '#56 skips a body passed as an unresolved name', path: '/root/file.ts', text: "it('x', someGlobalBody)" },
    { name: '#58 skips a spread argument', path: '/root/file.ts', text: 'it(...args)' },
    {
      name: '#66 does not count an import-equals assertion binding',
      path: '/root/file.ts',
      text: "import assert = require('node:assert')\nit('x', () => { assert.ok(a); expect(b).toBe(1) })",
    },
    {
      name: '#67 does not count a string-named import that is not expect',
      path: '/root/file.ts',
      text: "import { 'strictEqual' as same } from './equality'\nit('x', () => { same(a, b); expect(c).toBe(1) })",
    },
    {
      name: '#69 counts an aliased expect once',
      path: '/root/file.ts',
      text: "import { expect as e } from 'vitest'\nit('x', () => { e(a).toBe(1) })",
    },
  ],
  invalid: [
    {
      name: '#74 reports three assertions with every line',
      path: '/root/file.ts',
      text: "it('x', () => {\n  expect(a).toBe(1)\n  expect(b).toBe(2)\n  expect(c).toBe(3)\n})",
      errors: [
        {
          message:
            'A test body asserts one behaviour, but this one holds 3 assertions (on lines 2, 3 and 4). Split it into focused tests, each named for the single behaviour it asserts; when the checks jointly describe one indivisible behaviour, fold them into one assertion with a composite or asymmetric matcher such as expect.objectContaining.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 3,
        },
      ],
    },
    {
      name: '#75 reports assertions split across branches',
      path: '/root/file.ts',
      text: "it('x', () => {\n  if (result.ok) {\n    expect(result.value).toBe(1)\n  } else {\n    expect(result.error).toBe('x')\n  }\n})",
      errors: [
        {
          message:
            'A test body asserts one behaviour, but this one holds 2 assertions (on lines 3 and 5). Split it into focused tests, each named for the single behaviour it asserts; when the checks jointly describe one indivisible behaviour, fold them into one assertion with a composite or asymmetric matcher such as expect.objectContaining.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 3,
        },
      ],
    },
    {
      name: '#94 reports a namespace node:assert call beside a named one',
      path: '/root/file.ts',
      text: "import * as assert from 'node:assert'\nimport { ok } from 'assert/strict'\nit('x', () => {\n  assert.ok(a)\n  ok(b)\n})",
      errors: [
        {
          message:
            'A test body asserts one behaviour, but this one holds 2 assertions (on lines 4 and 5). Split it into focused tests, each named for the single behaviour it asserts; when the checks jointly describe one indivisible behaviour, fold them into one assertion with a composite or asymmetric matcher such as expect.objectContaining.',
          line: 3,
          column: 1,
          endLine: 3,
          endColumn: 3,
        },
      ],
    },
    {
      name: '#98 reports expect.poll beside expect',
      path: '/root/file.ts',
      text: "it('x', async () => { await expect.poll(() => a).toBe(1); expect(b).toBe(2) })",
      errors: [
        {
          message:
            'A test body asserts one behaviour, but this one holds 2 assertions (on line 1). Split it into focused tests, each named for the single behaviour it asserts; when the checks jointly describe one indivisible behaviour, fold them into one assertion with a composite or asymmetric matcher such as expect.objectContaining.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 3,
        },
      ],
    },
    {
      name: '#101 reports a helper that holds two assertions',
      path: '/root/file.ts',
      text: "function expectValid(value) {\n  expect(value.ok).toBe(true)\n  expect(value.errors).toEqual([])\n}\nit('x', () => {\n  expectValid(result)\n})",
      errors: [
        {
          message:
            'A test body asserts one behaviour, but this one holds 2 assertions (2 through expectValid (line 6)). Split it into focused tests, each named for the single behaviour it asserts; when the checks jointly describe one indivisible behaviour, fold them into one assertion with a composite or asymmetric matcher such as expect.objectContaining.',
          line: 5,
          column: 1,
          endLine: 5,
          endColumn: 3,
        },
      ],
    },
    {
      name: '#103 reports an assertion beside a helper',
      path: '/root/file.ts',
      text: "function expectValid(value) { expect(value.ok).toBe(true) }\nit('x', () => {\n  expect(result.count).toBe(1)\n  expectValid(result)\n})",
      errors: [
        {
          message:
            'A test body asserts one behaviour, but this one holds 2 assertions (on line 3, plus 1 through expectValid (line 4)). Split it into focused tests, each named for the single behaviour it asserts; when the checks jointly describe one indivisible behaviour, fold them into one assertion with a composite or asymmetric matcher such as expect.objectContaining.',
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 3,
        },
      ],
    },
    {
      name: '#106 reports a local helper called twice without counting its declaration',
      path: '/root/file.ts',
      text: "it('x', () => {\n  const check = (value) => { expect(value).toBe(1) }\n  check(a)\n  check(b)\n})",
      errors: [
        {
          message:
            'A test body asserts one behaviour, but this one holds 2 assertions (1 through check (line 3), plus 1 through check (line 4)). Split it into focused tests, each named for the single behaviour it asserts; when the checks jointly describe one indivisible behaviour, fold them into one assertion with a composite or asymmetric matcher such as expect.objectContaining.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 3,
        },
      ],
    },
    {
      name: '#108 reports a helper that reaches itself and asserts twice',
      path: '/root/file.ts',
      text: "function check(n) {\n  if (n > 0) check(n - 1)\n  expect(n).toBeGreaterThanOrEqual(0)\n  expect(n).toBeLessThan(3)\n}\nit('x', () => { check(2) })",
      errors: [
        {
          message:
            'A test body asserts one behaviour, but this one holds 2 assertions (2 through check (line 6)). Split it into focused tests, each named for the single behaviour it asserts; when the checks jointly describe one indivisible behaviour, fold them into one assertion with a composite or asymmetric matcher such as expect.objectContaining.',
          line: 6,
          column: 1,
          endLine: 6,
          endColumn: 3,
        },
      ],
    },
    {
      name: '#111 reports a helper reused by a second test',
      path: '/root/file.ts',
      text: "const expectValid = (value) => expect(value.ok).toBe(true)\nit('first', () => { expectValid(a); expectValid(b) })\nit('second', () => { expectValid(c); expectValid(d) })",
      errors: [
        {
          message:
            'A test body asserts one behaviour, but this one holds 2 assertions (1 through expectValid (line 2), plus 1 through expectValid (line 2)). Split it into focused tests, each named for the single behaviour it asserts; when the checks jointly describe one indivisible behaviour, fold them into one assertion with a composite or asymmetric matcher such as expect.objectContaining.',
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 3,
        },
        {
          message:
            'A test body asserts one behaviour, but this one holds 2 assertions (1 through expectValid (line 3), plus 1 through expectValid (line 3)). Split it into focused tests, each named for the single behaviour it asserts; when the checks jointly describe one indivisible behaviour, fold them into one assertion with a composite or asymmetric matcher such as expect.objectContaining.',
          line: 3,
          column: 1,
          endLine: 3,
          endColumn: 3,
        },
      ],
    },
    {
      name: '#114 reports with an empty options object',
      path: '/root/file.ts',
      text: "it('x', () => { expect(a).toBe(1); expect(b).toBe(2) })",
      options: {},
      errors: [
        {
          message:
            'A test body asserts one behaviour, but this one holds 2 assertions (on line 1). Split it into focused tests, each named for the single behaviour it asserts; when the checks jointly describe one indivisible behaviour, fold them into one assertion with a composite or asymmetric matcher such as expect.objectContaining.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 3,
        },
      ],
    },
  ],
})

testRule(rule, {
  valid: [
    {
      name: 'a method call on an object that is no assertion',
      path: SPEC,
      root: WORKSPACE,
      text: "it('x', () => { helpers.check(a); helpers['check'](b) })",
    },
    {
      name: 'a named import from another module beside a computed one',
      path: SPEC,
      root: WORKSPACE,
      text: "import { ok } from './result'\nit('x', () => { ok(a); ok['x'](b) })",
    },
    {
      name: 'a destructured helper',
      path: SPEC,
      root: WORKSPACE,
      text: "const { check } = helpers\nit('x', () => { check(a); check(b) })",
    },
    { name: 'a helper without an initialiser', path: SPEC, root: WORKSPACE, text: "let check\nit('x', () => { check(a); check(b) })" },
    {
      name: 'a class referenced from the body',
      path: SPEC,
      root: WORKSPACE,
      text: "class Check {}\nit('x', () => { new Check(); new Check() })",
    },
  ],
  invalid: [
    {
      name: 'a helper expression referenced inside its own body',
      path: SPEC,
      root: WORKSPACE,
      text: "const check = function self(n) { if (n) self(n - 1); expect(n).toBe(0) }\nit('x', () => { check(1); check(2) })",
      errors: [
        { message: message('1 through check (line 2), plus 1 through check (line 2)'), line: 2, column: 1, endLine: 2, endColumn: 3 },
      ],
    },
    {
      name: 'assertions out of source order in a conditional',
      path: SPEC,
      root: WORKSPACE,
      text: "it('x', () => {\n  const value = flag\n    ? expect(b).toBe(2)\n    : expect(a).toBe(1)\n  expect(value).toBe(1)\n})",
      errors: [{ message: message('on lines 3, 4 and 5').replace('holds 2', 'holds 3'), line: 1, column: 1, endLine: 1, endColumn: 3 }],
    },
  ],
})

describe('the disposable workspace', () => {
  it('is removed once the cases have run', () => {
    rmSync(ROOT, { recursive: true })
    expect(existsSync(ROOT)).toBe(false)
  })
})
