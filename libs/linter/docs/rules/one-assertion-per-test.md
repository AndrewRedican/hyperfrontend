# one-assertion-per-test

Limit each test body to one assertion, counting the assertions reached through same-file helpers.

## Rule Details

A unit test describes one behaviour. A test with two assertions names two behaviours at once, stops at the first failure and hides the second, and needs a title vague enough to cover both. The rule reports every test whose body reaches more than one assertion, on the declaring call, and names where the assertions are, so the author can choose between two remedies:

- **Split** the test into focused tests, each titled for the single behaviour it asserts.
- **Fold** the checks into one assertion when they jointly describe one indivisible behaviour, with a composite or asymmetric matcher such as `toEqual(expect.objectContaining({ ... }))` or `toMatchObject(...)`. A fold should still name what failed: compare a keyed object (`{ before, after }`) rather than a positional array of booleans whose failure reads `[true, false]`.

Which remedy fits is a judgement about the behaviour under test, so the rule does not fix. It never requires an assertion: a test with none is left alone.

### What is read

Tests are calls such as `it(...)`, `test(...)`, `fit(...)`, `xit(...)` and `xtest(...)`, modifier chains such as `it.only(...)`, `test.skip(...)`, `it.todo(...)`, `it.failing(...)` and `it.concurrent(...)` included, and the table forms such as `it.each(table)(...)`. The body is the first argument that is a function, or a name bound to a function in the same file. Suites and hooks are not tests, so assertions in them are not counted.

Assertions are `expect(...)` (under any local alias), `expect.soft(...)` and `expect.poll(...)`, and every call into the assert module, imported from `node:assert`, `node:assert/strict`, `assert` or `assert/strict` as a default, a namespace or named functions. Matcher builders (`expect.any(...)`, `expect.objectContaining(...)`, `expect.not.*` and the like) and the count declarations `expect.assertions(n)` and `expect.hasAssertions()` are not assertions.

### How assertions are counted

The count is lexical: every assertion written in the body counts once, including those inside nested callbacks such as an `items.forEach(...)` callback or a mock implementation. A loop that asserts once per element is one assertion over a collection; an `if`/`else` asserting in both branches is two. A reference to a function declared in the same file, called or passed as a callback, adds every assertion that function reaches, through further helpers too, so a helper called twice counts twice. A test declared inside another test is reported on its own and adds nothing to its parent.

## Options

This rule has no options. To leave files alone, such as fixture suites whose assertion shape is itself under test, scope the rule with the configuration's [`files`](https://www.hyperfrontend.dev/docs/libraries/linter/#api-ConfigBlock-prop-files) and [`ignores`](https://www.hyperfrontend.dev/docs/libraries/linter/#api-ConfigBlock-prop-ignores).

## Examples

### ❌ Incorrect

```ts
it('parses the manifest', () => {
  const manifest = parse(source)
  expect(manifest.name).toBe('demo')
  expect(manifest.version).toBe('1.2.3')
})

function expectValid(result: Result): void {
  expect(result.ok).toBe(true)
  expect(result.errors).toEqual([])
}

it('validates the manifest', () => {
  expectValid(validate(manifest))
})
```

### ✅ Correct

```ts
it('parses the manifest identity', () => {
  const manifest = parse(source)
  expect(manifest).toEqual(expect.objectContaining({ name: 'demo' }))
})

it('validates the manifest', () => {
  expect(validate(manifest)).toEqual({ ok: true, errors: [] })
})

it('reports every item as defined', () => {
  items.forEach((item) => expect(item).toBeDefined())
})

it('declares its assertion count', () => {
  expect.assertions(1)
  expect(add(1, 2)).toBe(3)
})
```

## When Not To Use It

For suites written as integration scenarios that walk through many states in one test, where a split would break the scenario. Scope the rule away from those files rather than switching it off for a project.

## Limitations

The rule reads one file at a time and has no type information. An assertion helper imported from another module, a method called on a class instance, and a body built by a call (`it('x', makeBody())`) are not seen.
