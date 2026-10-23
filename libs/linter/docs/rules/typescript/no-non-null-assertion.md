# typescript/no-non-null-assertion

Forbid the non-null assertion operator `!`.

## Rule Details

A postfix `!` tells the compiler a value is never `null` or `undefined` without checking, so a wrong assumption surfaces as a runtime error far from its cause. This rule reports every non-null assertion. It does not fix: narrow the value with a check, use optional chaining, or give it a type that cannot be nullish.

Reimplements [typescript-eslint's `no-non-null-assertion`](https://typescript-eslint.io/rules/no-non-null-assertion).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
const root = document.getElementById('root')!
root.append('ready')
```

### ✅ Correct

```ts
const root = document.getElementById('root')
if (root !== null) root.append('ready')
```

## Limitations

The original offers suggestions that replace `x!.y` with `x?.y`; this rule reports without them.
