# no-empty-character-class

Forbid empty character classes (`[]`) in regular expression literals.

## Rule Details

An empty character class matches no character at all, so the whole expression around it can never match. It is usually a class whose contents were lost, or an attempt at "any character", which is written `[^]`. The rule reports a regular expression literal holding an empty, non-negated class anywhere in its pattern, nested classes of the `v` flag included. The negated empty class `[^]` is left alone. The rule does not fix.

Reimplements [ESLint's `no-empty-character-class`](https://eslint.org/docs/latest/rules/no-empty-character-class).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
const never = /^abc[]/
const nested = /[a[]]/v
```

### ✅ Correct

```ts
const letters = /^abc[a-z]/
const anything = /^abc[^]/
const bracket = /\[]/
```

## Limitations

Patterns passed to `RegExp(...)` as strings are not read, as in the original.
