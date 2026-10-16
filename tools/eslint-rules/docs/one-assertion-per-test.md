# one-assertion-per-test

Limit each test body to one assertion, counting the assertions reached through same-file helpers.

## Rule Details

A unit test describes one behaviour. When it holds two assertions it names two behaviours at once, stops at the first failure and hides the second, and its title has to be vague enough to cover both. The rule reports every test whose body reaches more than one assertion and names where they are, so the author can choose between the two remedies:

- **Split** the test into focused tests, each titled for the single behaviour it asserts.
- **Fold** the checks into one assertion when they jointly describe one indivisible behaviour, using a composite or asymmetric matcher such as `toEqual(expect.objectContaining({ ... }))`, `toEqual(expect.arrayContaining([...]))` or `toMatchObject`.

Which remedy fits is a judgement about the behaviour under test, not about the number of `expect` calls, so the rule never fixes anything on its own. It also never requires an assertion: a test with none is left alone.

A fold should still name what failed. Prefer `toEqual` on a keyed object (`{ before, after }`) or on the inputs that broke (`inputs.filter((input) => !isValid(input))` against `[]`) over a positional array of booleans, whose failure reads `[true, false]` and names nothing.

### What declares a test

`it`, `test`, `fit`, `xit` and `xtest`, with or without the modifiers `only`, `skip`, `todo`, `failing`, `concurrent` and `each`, including the table forms `it.each(table)(...)` and ``it.each`table`(...)``. The body is the first argument that is a function, or a name bound to a function in the same file; a body built by a call or imported from another module is not read. `describe` blocks and hooks (`beforeEach`, `afterEach` and the rest) are not tests, so assertions inside them are not counted.

### What counts as an assertion

- `expect(...)`, however it is imported, and under an alias such as `import { expect as e }`.
- `expect.soft(...)` and `expect.poll(...)`, which start an assertion in vitest.
- Every call into the `node:assert` family: `assert(...)`, `assert.ok(...)`, `assert.deepStrictEqual(...)` and the rest, whether the module is imported as a default, a namespace, `strict`, or by named functions, from `node:assert`, `node:assert/strict`, `assert` or `assert/strict`.

Matcher arguments are not assertions: `expect.any`, `expect.anything`, `expect.objectContaining`, `expect.arrayContaining`, `expect.stringContaining`, `expect.stringMatching`, `expect.closeTo` and `expect.not.*` build the value one assertion compares against. Neither are the assertion-count declarations `expect.assertions(n)` and `expect.hasAssertions()`.

### How assertions are counted

The count is lexical: every assertion call written in the body counts once, including the ones inside nested callbacks such as a `forEach` body, an event handler, a `done`-style continuation or a mock implementation. A loop that asserts once per element is therefore one assertion over a collection, and an `if`/`else` that asserts in both branches is two.

Assertions do not disappear by moving them into a helper. A reference to a function declared in the same file, whether the helper is called or passed as a callback, adds every assertion that function reaches, including through further helpers. A helper called twice counts twice. A function bound to a name inside the body is counted through its references rather than at its declaration, so a local helper counts once per call.

Nested test and suite declarations are a boundary: a test declared inside another test, or by a shared-examples helper, is reported on its own and does not add to the test that declared it.

### What is not seen

- A helper imported from another module. The rule reads one file at a time, so an assertion helper in a shared module is invisible; moving assertions there to pass the rule is a convention violation, not a technique.
- A method on a class instance, since the rule has no type information to resolve the call.
- A body passed as the result of a call, such as `it('x', makeBody())`.

## Examples

### ❌ Incorrect

```typescript
it('parses the manifest', () => {
  const manifest = parse(source)
  expect(manifest.name).toBe('demo')
  expect(manifest.version).toBe('1.2.3')
})

it('rejects a missing file and an empty one', () => {
  expect(() => read('')).toThrow(/missing/)
  expect(() => read(' ')).toThrow(/empty/)
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

```typescript
it('parses the manifest identity', () => {
  expect(parse(source)).toEqual(expect.objectContaining({ name: 'demo', version: '1.2.3' }))
})

it('rejects a missing file', () => {
  expect(() => read('')).toThrow(/missing/)
})

it('rejects an empty file', () => {
  expect(() => read(' ')).toThrow(/empty/)
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

## Options

```json
{
  "workspace/one-assertion-per-test": ["error", { "exclude": ["apps/package-e2e/testing/src/fixtures/**"] }]
}
```

### `exclude`

Workspace-relative globs naming spec files the rule leaves alone, matched with `posix.matchesGlob` from `node:path` against the file's path from the workspace root, written with forward slashes (`libs/demo/src/demo.spec.ts`). Patterns are matched against the workspace root rather than the ESLint config's location, so one setting in a shared base config names the same files whichever project's lint target runs it. Outside a workspace no pattern matches and the rule applies. Defaults to none.

Use it only for files whose assertion shape is itself the thing under test, such as fixture suites a test-runner's end-to-end suite executes and counts, and say why beside the setting.

## When Not To Use It

If a suite is deliberately written as integration scenarios that walk through many states in one test, the rule will ask for a split that the scenario cannot survive. Scope the rule away from those files with `exclude`, or with the config's own `files` and `ignores`, rather than switching it off for a project.

## Related Rules

- `assertive-test-names`: titles that state the one behaviour the test asserts
