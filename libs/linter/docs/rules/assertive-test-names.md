# assertive-test-names

Forbid the word "should" in test titles.

## Rule Details

A test title states a fact: "returns null for empty input" is shorter and clearer than "should return null for empty input". The rule reports a title containing the word "should", in any letter case, on the test-declaring calls of Jest-style runners: [`it`](https://jestjs.io/docs/api#testname-fn-timeout), [`test`](https://jestjs.io/docs/api#testname-fn-timeout), [`fit`](https://jestjs.io/docs/api#testonlyname-fn-timeout), [`xit`](https://jestjs.io/docs/api#testskipname-fn) and [`xtest`](https://jestjs.io/docs/api#testskipname-fn). Modifier chains (`it.only(...)`, `test.skip(...)`, `test.todo(...)`, `it.failing(...)`, `it.concurrent(...)`) and table forms (`it.each(table)(...)`, ``it.each`table`(...)``) are checked too.

Suite titles passed to [`describe`](https://jestjs.io/docs/api#describename-fn) are left alone: they name units, not behaviours. Titles computed at run time, such as a template literal with substitutions, are not read. The rule does not fix.

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
it('should return the correct value', () => {})

test('should throw an error when input is invalid', () => {})

test.only('should execute the focused test', () => {})

it.each([1, 2])('should handle %s', () => {})
```

### ✅ Correct

```ts
it('returns the correct value', () => {})

test('throws an error when input is invalid', () => {})

it.each([1, 2])('handles %s', () => {})

describe('should-style prose is allowed in suite titles', () => {})
```
