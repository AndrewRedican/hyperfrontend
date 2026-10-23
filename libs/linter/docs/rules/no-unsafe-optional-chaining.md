# no-unsafe-optional-chaining

Forbid using an optional chain where its `undefined` result would throw.

## Rule Details

An optional chain such as `user?.profile` evaluates to `undefined` when it short-circuits. Used where a value is required, that `undefined` throws a `TypeError`, which defeats the point of the `?.`. The rule reports a chain, possibly behind `&&`, `||`, `??`, a conditional, a sequence or `await`, used as:

- the callee of a call or of `new`, or the tag of a tagged template, as in `(user?.greet)()`;
- the object of a member access, as in `(user?.profile).name`;
- the value destructured by a declaration, an assignment or a default;
- the source of an array or argument spread, or of a `for...of` loop;
- a superclass, or the right side of `in` or `instanceof`.

Continuing the chain with another `?.` is safe and not reported. The rule does not fix.

Reimplements [ESLint's `no-unsafe-optional-chaining`](https://eslint.org/docs/latest/rules/no-unsafe-optional-chaining).

## Options

This rule has no options. The original's [`disallowArithmeticOperators`](https://eslint.org/docs/latest/rules/no-unsafe-optional-chaining#options) option is not read, so arithmetic on an optional chain, which yields `NaN` rather than throwing, is not reported.

## Examples

### ❌ Incorrect

```ts
const name = (user?.profile).name
const { id } = user?.profile
const all = [...user?.roles]
for (const role of user?.roles) {
}
```

### ✅ Correct

```ts
const name = user?.profile?.name
const { id } = user?.profile ?? {}
const all = [...(user?.roles ?? [])]
```
