# typescript/no-non-null-asserted-optional-chain

Forbid a non-null assertion on the result of an optional chain.

## Rule Details

An optional chain evaluates to `undefined` when a link is missing, by design. A `!` after the chain, or after the chain in parentheses, tells the compiler that cannot happen, which hides exactly the case the chain was written to handle. This rule reports both shapes. It does not fix: drop the `!` and handle `undefined`, or drop the `?.` if the value is known to exist.

Reimplements [typescript-eslint's `no-non-null-asserted-optional-chain`](https://typescript-eslint.io/rules/no-non-null-asserted-optional-chain).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
const city = user?.address!
const zip = (user?.address)!.zip
```

### ✅ Correct

```ts
const city = user?.address
const zip = user!.address.zip
```

## Limitations

The original offers a suggestion that removes the `!`; this rule reports without one.
