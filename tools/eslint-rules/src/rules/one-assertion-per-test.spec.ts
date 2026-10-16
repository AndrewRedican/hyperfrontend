import { after as afterAll } from 'node:test'
import { createTempWorkspaceManager, createTypeScriptRuleTester } from '../testing'
import rule, { RULE_NAME } from './one-assertion-per-test'

const manager = createTempWorkspaceManager()

afterAll(() => manager.cleanupAll())

const workspace = manager.create({ files: { 'nx.json': '{}' } })
const insideWorkspace = workspace.getPath('libs/demo/src/demo.spec.ts')
const outsideWorkspace = manager.create().getPath('src/demo.spec.ts')

const ruleTester = createTypeScriptRuleTester()

const MESSAGE_ID = 'tooManyAssertions'

ruleTester.run(RULE_NAME, rule, {
  valid: [
    { name: 'allows one assertion', code: `it('adds', () => { expect(add(1, 2)).toBe(3) })` },
    { name: 'allows a test without assertions', code: `it('runs', () => { run() })` },
    { name: 'allows a test declaring its assertion count', code: `it('x', () => { expect.assertions(1); expect(a).toBe(1) })` },
    { name: 'allows a test declaring it asserts at all', code: `it('x', () => { expect.hasAssertions(); expect(a).toBe(1) })` },
    {
      name: 'does not count asymmetric matchers as assertions',
      code: `it('x', () => {
  expect(result).toEqual({
    id: expect.any(String),
    items: expect.arrayContaining([expect.objectContaining({ name: 'a' })]),
    text: expect.stringContaining('ok'),
    note: expect.not.stringMatching(/x/),
    value: expect.closeTo(1, 2),
    other: expect.anything(),
  })
})`,
    },
    { name: 'does not count a computed member on expect', code: `it('x', () => { expect(a).toBe(1); expect['any'](Number) })` },
    { name: 'counts a negated chain once', code: `it('x', () => { expect(a).not.toBe(1) })` },
    { name: 'counts an awaited promise matcher once', code: `it('x', async () => { await expect(promise).resolves.toBe(1) })` },
    { name: 'counts a rejection matcher once', code: `it('x', async () => { await expect(promise).rejects.toThrow('boom') })` },
    {
      name: 'counts one assertion inside a nested callback',
      code: `it('x', () => { items.forEach((item) => { expect(item).toBeDefined() }) })`,
    },
    {
      name: 'counts one assertion inside a done callback',
      code: `it('x', (done) => {
  emitter.on('end', () => {
    expect(seen).toBe(1)
    done()
  })
})`,
    },
    { name: 'allows one assertion in a function expression body', code: `it('x', function () { expect(a).toBe(1) })` },
    { name: 'allows one assertion with a per-test timeout', code: `it('x', () => { expect(a).toBe(1) }, 5000)` },
    { name: 'allows test', code: `test('x', () => { expect(a).toBe(1) })` },
    { name: 'allows fit', code: `fit('x', () => { expect(a).toBe(1) })` },
    { name: 'allows xit', code: `xit('x', () => { expect(a).toBe(1) })` },
    { name: 'allows xtest', code: `xtest('x', () => { expect(a).toBe(1) })` },
    { name: 'allows it.only', code: `it.only('x', () => { expect(a).toBe(1) })` },
    { name: 'allows it.skip', code: `it.skip('x', () => { expect(a).toBe(1) })` },
    { name: 'allows it.concurrent', code: `it.concurrent('x', () => { expect(a).toBe(1) })` },
    { name: 'allows it.failing', code: `it.failing('x', () => { expect(a).toBe(1) })` },
    { name: 'allows it.todo without a body', code: `it.todo('x')` },
    { name: 'allows it.skip without a body', code: `it.skip('x')` },
    { name: 'allows a test with no arguments', code: `it()` },
    { name: 'allows a test whose body is only a title', code: `test.only()` },
    {
      name: 'allows it.each with one assertion per row',
      code: `it.each([[1, 2, 3]])('adds %s and %s', (a, b, sum) => { expect(a + b).toBe(sum) })`,
    },
    {
      name: 'allows a tagged-template it.each with one assertion',
      code: "it.each`\n  a | b\n  ${1} | ${2}\n`('adds $a', ({ a, b }) => { expect(a + b).toBe(3) })",
    },
    { name: 'allows it.only.each with one assertion', code: `it.only.each([1])('x %s', (n) => { expect(n).toBe(1) })` },
    { name: 'ignores a call that is not a test declaration', code: `check('x', () => { expect(a).toBe(1); expect(b).toBe(2) })` },
    { name: 'ignores a method named like a test', code: `suite.it('x', () => { expect(a).toBe(1); expect(b).toBe(2) })` },
    { name: 'ignores a computed test modifier', code: `it['only']('x', () => { expect(a).toBe(1); expect(b).toBe(2) })` },
    { name: 'ignores a sequence expression callee', code: `(0, it)('x', () => { expect(a).toBe(1); expect(b).toBe(2) })` },
    { name: 'ignores a foreign tagged template', code: "tag`table`('x', () => { expect(a).toBe(1); expect(b).toBe(2) })" },
    { name: 'ignores a foreign each', code: `foo.each([1])('x', () => { expect(a).toBe(1); expect(b).toBe(2) })` },
    {
      name: 'counts each test in a suite on its own',
      code: `describe('math', () => {
  it('adds', () => { expect(add(1, 2)).toBe(3) })
  it('subtracts', () => { expect(subtract(3, 2)).toBe(1) })
})`,
    },
    {
      name: 'does not count assertions in hooks',
      code: `describe('x', () => {
  beforeEach(() => { expect(setup()).toBe(true) })
  afterEach(() => { expect(teardown()).toBe(true) })
  it('x', () => { expect(a).toBe(1) })
})`,
    },
    {
      name: 'does not count assertions in a nested test',
      code: `it('outer', () => {
  expect(a).toBe(1)
  it('inner', () => { expect(b).toBe(2) })
})`,
    },
    {
      name: 'does not count assertions in a nested suite',
      code: `it('outer', () => {
  expect(a).toBe(1)
  describe('inner', () => { it('x', () => { expect(b).toBe(2) }) })
})`,
    },
    {
      name: 'does not count tests a shared-examples helper declares',
      code: `function itBehavesLikeAList(make) {
  it('is empty at first', () => { expect(make().size).toBe(0) })
  it('grows', () => { expect(make().add(1).size).toBe(1) })
}
it('x', () => {
  itBehavesLikeAList(create)
  expect(a).toBe(1)
})`,
    },
    {
      name: 'counts a same-file helper once per reference',
      code: `function expectValid(value) {
  expect(value.ok).toBe(true)
}
it('x', () => { expectValid(result) })`,
    },
    {
      name: 'counts an arrow helper once per reference',
      code: `const expectValid = (value) => expect(value.ok).toBe(true)
it('x', () => { expectValid(result) })`,
    },
    {
      name: 'counts a local helper through its references rather than its declaration',
      code: `it('x', () => {
  const check = (value) => { expect(value).toBe(1) }
  check(a)
})`,
    },
    {
      name: 'counts a local function declaration through its references',
      code: `it('x', () => {
  function check(value) { expect(value).toBe(1) }
  check(a)
})`,
    },
    {
      name: 'does not count a helper without assertions',
      code: `const make = () => ({ a: 1 })\nit('x', () => { expect(make()).toEqual({ a: 1 }) })`,
    },
    {
      name: 'does not count a helper never referenced',
      code: `const check = () => { expect(a).toBe(1); expect(b).toBe(2) }\nit('x', () => { expect(c).toBe(3) })`,
    },
    {
      name: 'does not count a helper imported from another module',
      code: `import { expectValid } from './helpers'\nit('x', () => { expectValid(result); expect(a).toBe(1) })`,
    },
    {
      name: 'does not count a default import called as a helper',
      code: `import check from './helpers'\nit('x', () => { check(result); expect(a).toBe(1) })`,
    },
    {
      name: 'does not count a parameter called as a helper',
      code: `const run = (check) => it('x', () => { check(a); expect(b).toBe(1) })`,
    },
    { name: 'does not count a variable declared without a value', code: `let check\nit('x', () => { check(a); expect(b).toBe(1) })` },
    { name: 'does not count a variable holding a non-function', code: `const check = 1\nit('x', () => { expect(check).toBe(1) })` },
    {
      name: 'does not count a declared function without a body',
      code: `declare function check(value: unknown): void\nit('x', () => { check(a); expect(b).toBe(1) })`,
    },
    { name: 'ignores the implicit arguments object', code: `it('x', function () { expect(arguments.length).toBe(0) })` },
    { name: 'ignores a destructuring declarator', code: `it('x', () => { const { a } = make(); const [, b] = pair; expect(a).toBe(b) })` },
    {
      name: 'survives a helper that reaches itself',
      code: `function check(n) { if (n > 0) check(n - 1); expect(n).toBe(0) }\nit('x', () => { check(2) })`,
    },
    { name: 'reads a body passed by name', code: `function body() { expect(a).toBe(1) }\nit('x', body)` },
    { name: 'skips a body passed as an unresolved name', code: `it('x', someGlobalBody)` },
    { name: 'skips a body built by a factory call', code: `it('x', makeBody())` },
    { name: 'skips a spread argument', code: `it(...args)` },
    { name: 'reads the body after a title held in a variable', code: `const title = 'x'\nit(title, () => { expect(a).toBe(1) })` },
    { name: 'allows one node:assert call', code: `import assert from 'node:assert/strict'\nit('x', () => { assert.strictEqual(a, 1) })` },
    {
      name: 'allows one named node:assert import call',
      code: `import { deepStrictEqual } from 'node:assert'\nit('x', () => { deepStrictEqual(a, b) })`,
    },
    {
      name: 'does not count a function named like an assertion from another module',
      code: `import { ok } from './result'\nit('x', () => { ok(a); expect(b).toBe(1) })`,
    },
    {
      name: 'does not count members of an object from another module',
      code: `import { api } from './api'\nit('x', () => { api.ok(a); expect(b).toBe(1) })`,
    },
    { name: 'does not count members of an undeclared object', code: `it('x', () => { helpers.check(a); expect(b).toBe(1) })` },
    { name: 'does not count a call whose callee is a call', code: `it('x', () => { make()(a); expect(b).toBe(1) })` },
    {
      name: 'does not count an import-equals assertion binding',
      code: `import assert = require('node:assert')\nit('x', () => { assert.ok(a); expect(b).toBe(1) })`,
    },
    {
      name: 'does not count a string-named import that is not expect',
      code: `import { 'strictEqual' as same } from './equality'\nit('x', () => { same(a, b); expect(c).toBe(1) })`,
    },
    { name: 'allows one expect.soft', code: `it('x', () => { expect.soft(a).toBe(1) })` },
    { name: 'counts an aliased expect once', code: `import { expect as e } from 'vitest'\nit('x', () => { e(a).toBe(1) })` },
    {
      name: 'counts a mock implementation assertion inline',
      code: `it('x', () => { const spy = jest.fn((value) => { expect(value).toBe(1) }); run(spy) })`,
    },
    {
      name: 'leaves an excluded file alone',
      code: `it('x', () => { expect(a).toBe(1); expect(b).toBe(2) })`,
      filename: insideWorkspace,
      options: [{ exclude: ['libs/demo/**'] }],
    },
    {
      name: 'matches exclusions against the workspace-relative path',
      code: `it('x', () => { expect(a).toBe(1); expect(b).toBe(2) })`,
      filename: insideWorkspace,
      options: [{ exclude: ['**/*.spec.ts'] }],
    },
  ],
  invalid: [
    {
      name: 'reports two assertions',
      code: `it('x', () => {
  expect(a).toBe(1)
  expect(b).toBe(2)
})`,
      errors: [{ messageId: MESSAGE_ID, data: { count: '2', where: 'on lines 2 and 3' } }],
    },
    {
      name: 'reports three assertions with every line',
      code: `it('x', () => {
  expect(a).toBe(1)
  expect(b).toBe(2)
  expect(c).toBe(3)
})`,
      errors: [{ messageId: MESSAGE_ID, data: { count: '3', where: 'on lines 2, 3 and 4' } }],
    },
    {
      name: 'reports assertions split across branches',
      code: `it('x', () => {
  if (result.ok) {
    expect(result.value).toBe(1)
  } else {
    expect(result.error).toBe('x')
  }
})`,
      errors: [{ messageId: MESSAGE_ID, data: { count: '2', where: 'on lines 3 and 5' } }],
    },
    {
      name: 'reports two assertions in a test',
      code: `test('x', () => { expect(a).toBe(1); expect(b).toBe(2) })`,
      errors: [{ messageId: MESSAGE_ID }],
    },
    {
      name: 'reports two assertions in fit',
      code: `fit('x', () => { expect(a).toBe(1); expect(b).toBe(2) })`,
      errors: [{ messageId: MESSAGE_ID }],
    },
    {
      name: 'reports two assertions in xit',
      code: `xit('x', () => { expect(a).toBe(1); expect(b).toBe(2) })`,
      errors: [{ messageId: MESSAGE_ID }],
    },
    {
      name: 'reports two assertions in xtest',
      code: `xtest('x', () => { expect(a).toBe(1); expect(b).toBe(2) })`,
      errors: [{ messageId: MESSAGE_ID }],
    },
    {
      name: 'reports two assertions in it.only',
      code: `it.only('x', () => { expect(a).toBe(1); expect(b).toBe(2) })`,
      errors: [{ messageId: MESSAGE_ID }],
    },
    {
      name: 'reports two assertions in it.skip',
      code: `it.skip('x', () => { expect(a).toBe(1); expect(b).toBe(2) })`,
      errors: [{ messageId: MESSAGE_ID }],
    },
    {
      name: 'reports two assertions in it.concurrent',
      code: `it.concurrent('x', () => { expect(a).toBe(1); expect(b).toBe(2) })`,
      errors: [{ messageId: MESSAGE_ID }],
    },
    {
      name: 'reports two assertions in it.failing',
      code: `it.failing('x', () => { expect(a).toBe(1); expect(b).toBe(2) })`,
      errors: [{ messageId: MESSAGE_ID }],
    },
    {
      name: 'reports two assertions in an it.each row body',
      code: `it.each([[1, 2]])('x %s', (a, b) => { expect(a).toBe(1); expect(b).toBe(2) })`,
      errors: [{ messageId: MESSAGE_ID }],
    },
    {
      name: 'reports two assertions in a tagged-template it.each body',
      code: "it.each`\n  a\n  ${1}\n`('x $a', ({ a }) => { expect(a).toBe(1); expect(a).not.toBe(2) })",
      errors: [{ messageId: MESSAGE_ID }],
    },
    {
      name: 'reports two assertions in it.only.each',
      code: `it.only.each([1])('x %s', (n) => { expect(n).toBe(1); expect(n).not.toBe(2) })`,
      errors: [{ messageId: MESSAGE_ID }],
    },
    {
      name: 'reports two assertions in a function expression body',
      code: `it('x', function () { expect(a).toBe(1); expect(b).toBe(2) })`,
      errors: [{ messageId: MESSAGE_ID }],
    },
    {
      name: 'reports two assertions in an async body',
      code: `it('x', async () => {
  await expect(first).resolves.toBe(1)
  await expect(second).rejects.toThrow()
})`,
      errors: [{ messageId: MESSAGE_ID, data: { count: '2', where: 'on lines 2 and 3' } }],
    },
    {
      name: 'reports two assertions reached through a done callback',
      code: `it('x', (done) => {
  emitter.on('end', () => {
    expect(a).toBe(1)
    expect(b).toBe(2)
    done()
  })
})`,
      errors: [{ messageId: MESSAGE_ID, data: { count: '2', where: 'on lines 3 and 4' } }],
    },
    {
      name: 'reports an assertion beside one in a nested callback',
      code: `it('x', () => {
  expect(items).toHaveLength(2)
  items.forEach((item) => { expect(item).toBeDefined() })
})`,
      errors: [{ messageId: MESSAGE_ID, data: { count: '2', where: 'on lines 2 and 3' } }],
    },
    {
      name: 'reports two assertions in a sibling test and not the compliant one',
      code: `describe('x', () => {
  it('ok', () => { expect(a).toBe(1) })
  it('bad', () => { expect(b).toBe(2); expect(c).toBe(3) })
})`,
      errors: [{ messageId: MESSAGE_ID, line: 3 }],
    },
    {
      name: 'reports the outer and the nested test separately',
      code: `it('outer', () => {
  expect(a).toBe(1)
  expect(b).toBe(2)
  it('inner', () => { expect(c).toBe(3); expect(d).toBe(4) })
})`,
      errors: [
        { messageId: MESSAGE_ID, line: 1, data: { count: '2', where: 'on lines 2 and 3' } },
        { messageId: MESSAGE_ID, line: 4, data: { count: '2', where: 'on line 4' } },
      ],
    },
    {
      name: 'reports two node:assert calls',
      code: `import assert from 'node:assert/strict'
it('x', () => {
  assert.strictEqual(a, 1)
  assert.deepStrictEqual(b, [])
})`,
      errors: [{ messageId: MESSAGE_ID, data: { count: '2', where: 'on lines 3 and 4' } }],
    },
    {
      name: 'reports a namespace node:assert call beside a named one',
      code: `import * as assert from 'node:assert'
import { ok } from 'assert/strict'
it('x', () => {
  assert.ok(a)
  ok(b)
})`,
      errors: [{ messageId: MESSAGE_ID, data: { count: '2', where: 'on lines 4 and 5' } }],
    },
    {
      name: 'reports the strict namespace imported by name',
      code: `import { strict as assert } from 'assert'
it('x', () => {
  assert.equal(a, 1)
  assert['ok'](b)
})`,
      errors: [{ messageId: MESSAGE_ID, data: { count: '2', where: 'on lines 3 and 4' } }],
    },
    {
      name: 'reports expect mixed with node:assert',
      code: `import assert from 'node:assert/strict'
it('x', () => {
  expect(a).toBe(1)
  assert.ok(b)
})`,
      errors: [{ messageId: MESSAGE_ID }],
    },
    {
      name: 'reports two expect.soft calls',
      code: `it('x', () => { expect.soft(a).toBe(1); expect.soft(b).toBe(2) })`,
      errors: [{ messageId: MESSAGE_ID }],
    },
    {
      name: 'reports expect.poll beside expect',
      code: `it('x', async () => { await expect.poll(() => a).toBe(1); expect(b).toBe(2) })`,
      errors: [{ messageId: MESSAGE_ID }],
    },
    {
      name: 'reports two aliased expect calls',
      code: `import { expect as e } from 'vitest'\nit('x', () => { e(a).toBe(1); e(b).toBe(2) })`,
      errors: [{ messageId: MESSAGE_ID }],
    },
    {
      name: 'reports a string-named expect alias',
      code: `import { 'expect' as e } from 'vitest'\nit('x', () => { e(a).toBe(1); e(b).toBe(2) })`,
      errors: [{ messageId: MESSAGE_ID }],
    },
    {
      name: 'reports a helper that holds two assertions',
      code: `function expectValid(value) {
  expect(value.ok).toBe(true)
  expect(value.errors).toEqual([])
}
it('x', () => {
  expectValid(result)
})`,
      errors: [{ messageId: MESSAGE_ID, data: { count: '2', where: '2 through expectValid (line 6)' } }],
    },
    {
      name: 'reports a helper called twice',
      code: `const expectValid = (value) => expect(value.ok).toBe(true)
it('x', () => {
  expectValid(first)
  expectValid(second)
})`,
      errors: [
        { messageId: MESSAGE_ID, data: { count: '2', where: '1 through expectValid (line 3), plus 1 through expectValid (line 4)' } },
      ],
    },
    {
      name: 'reports an assertion beside a helper',
      code: `function expectValid(value) { expect(value.ok).toBe(true) }
it('x', () => {
  expect(result.count).toBe(1)
  expectValid(result)
})`,
      errors: [{ messageId: MESSAGE_ID, data: { count: '2', where: 'on line 3, plus 1 through expectValid (line 4)' } }],
    },
    {
      name: 'reports a helper passed as a callback',
      code: `const expectValid = (value) => { expect(value.ok).toBe(true) }
it('x', () => {
  results.forEach(expectValid)
  others.forEach(expectValid)
})`,
      errors: [
        { messageId: MESSAGE_ID, data: { count: '2', where: '1 through expectValid (line 3), plus 1 through expectValid (line 4)' } },
      ],
    },
    {
      name: 'reports assertions reached through a chain of helpers',
      code: `function expectShape(value) { expect(value).toEqual(expect.objectContaining({ ok: true })) }
function expectValid(value) {
  expectShape(value)
  expect(value.errors).toEqual([])
}
it('x', () => { expectValid(result) })`,
      errors: [{ messageId: MESSAGE_ID, data: { count: '2', where: '2 through expectValid (line 6)' } }],
    },
    {
      name: 'reports a local helper called twice without counting its declaration',
      code: `it('x', () => {
  const check = (value) => { expect(value).toBe(1) }
  check(a)
  check(b)
})`,
      errors: [{ messageId: MESSAGE_ID, data: { count: '2', where: '1 through check (line 3), plus 1 through check (line 4)' } }],
    },
    {
      name: 'reports a local function declaration called twice',
      code: `it('x', () => {
  function check(value) { expect(value).toBe(1) }
  check(a)
  check(b)
})`,
      errors: [{ messageId: MESSAGE_ID, data: { count: '2', where: '1 through check (line 3), plus 1 through check (line 4)' } }],
    },
    {
      name: 'reports a helper that reaches itself and asserts twice',
      code: `function check(n) {
  if (n > 0) check(n - 1)
  expect(n).toBeGreaterThanOrEqual(0)
  expect(n).toBeLessThan(3)
}
it('x', () => { check(2) })`,
      errors: [{ messageId: MESSAGE_ID, data: { count: '2', where: '2 through check (line 6)' } }],
    },
    {
      name: 'reports a body passed by name',
      code: `function body() {
  expect(a).toBe(1)
  expect(b).toBe(2)
}
it('x', body)`,
      errors: [{ messageId: MESSAGE_ID, data: { count: '2', where: 'on lines 2 and 3' } }],
    },
    {
      name: 'reports a body passed by name after a variable title',
      code: `const title = 'x'
const body = () => { expect(a).toBe(1); expect(b).toBe(2) }
it(title, body)`,
      errors: [{ messageId: MESSAGE_ID }],
    },
    {
      name: 'reports a helper reused by a second test',
      code: `const expectValid = (value) => expect(value.ok).toBe(true)
it('first', () => { expectValid(a); expectValid(b) })
it('second', () => { expectValid(c); expectValid(d) })`,
      errors: [
        { messageId: MESSAGE_ID, line: 2 },
        { messageId: MESSAGE_ID, line: 3 },
      ],
    },
    {
      name: 'reports a file no exclusion matches',
      code: `it('x', () => { expect(a).toBe(1); expect(b).toBe(2) })`,
      filename: insideWorkspace,
      options: [{ exclude: ['apps/**'] }],
      errors: [{ messageId: MESSAGE_ID }],
    },
    {
      name: 'ignores exclusions outside a workspace',
      code: `it('x', () => { expect(a).toBe(1); expect(b).toBe(2) })`,
      filename: outsideWorkspace,
      options: [{ exclude: ['**'] }],
      errors: [{ messageId: MESSAGE_ID }],
    },
    {
      name: 'reports with an empty options object',
      code: `it('x', () => { expect(a).toBe(1); expect(b).toBe(2) })`,
      options: [{}],
      errors: [{ messageId: MESSAGE_ID }],
    },
  ],
})
