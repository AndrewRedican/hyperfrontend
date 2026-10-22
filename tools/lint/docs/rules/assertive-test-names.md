# assertive-test-names

Prohibit the word "should" in test descriptions.

## Rule Details

This rule enforces assertive, fact-based test names by prohibiting the use of the word "should" in test descriptions. Test names that state facts rather than possibilities are clearer and more declarative.

The rule checks `it`, `test`, `fit`, `xit`, and `xtest` calls, including modifier chains (`it.only`, `test.skip`, `test.todo`, `it.failing`, `it.concurrent`) and table forms (`it.each(table)(...)`, ``it.each`table`(...)``, `it.only.each(table)(...)`). `describe` blocks are not checked: they name units, not behaviours.

### Why?

- **Clarity**: "returns null for empty input" is more direct than "should return null for empty input"
- **Brevity**: Removing "should" reduces noise without losing meaning
- **Consistency**: Enforces a uniform style across the test suite

## Examples

### ❌ Incorrect

```typescript
it('should return the correct value', () => {
  // ...
})

test('should throw an error when input is invalid', () => {
  // ...
})

test.only('should execute the focused test', () => {
  // ...
})

it.each([1, 2])('should handle %s', () => {
  // ...
})
```

### ✅ Correct

```typescript
it('returns the correct value', () => {
  // ...
})

test('throws an error when input is invalid', () => {
  // ...
})

it('handles edge cases gracefully', () => {
  // ...
})

it.each([1, 2])('handles %s', () => {
  // ...
})

describe('should-style prose is allowed in describe blocks', () => {
  // ...
})
```

## When Not To Use It

If your team prefers BDD-style test naming conventions that use "should", you may want to disable this rule.

## Related Rules

- None
