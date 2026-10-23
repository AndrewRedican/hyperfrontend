# no-constant-binary-expression

Forbid comparisons and logical expressions whose outcome does not depend on the value being tested.

## Rule Details

Some expressions look like they test a value but always evaluate the same way, usually because of operator precedence or a misunderstanding of how `??` and `===` work. The rule reports:

- a `&&` or `||` whose left side is always truthy or always falsy, and a `??` whose left side is never or always nullish, such as `{ ...options } ?? fallback`;
- an `==`, `===`, `!=` or `!==` against `null`, `undefined` or a boolean whose result is fixed by the other operand's shape alone, such as `a + b === null` or `!value == null`;
- a strict comparison against an object, array, function or class created on the spot, which can never be equal to anything else, and a loose comparison of two such values.

Names bound to the global `undefined`, `Boolean` and the like are only treated as constant when they are not shadowed. The rule does not fix.

Reimplements [ESLint's `no-constant-binary-expression`](https://eslint.org/docs/latest/rules/no-constant-binary-expression).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
const value1 = +x == null
const value2 = { ...options } ?? fallback
const value3 = items === []
const value4 = !foo == null
```

### ✅ Correct

```ts
const value1 = x == null
const value2 = options ?? fallback
const value3 = items.length === 0
const value4 = foo == null
```
