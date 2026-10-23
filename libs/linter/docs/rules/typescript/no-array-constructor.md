# typescript/no-array-constructor

Forbid building arrays with the `Array` constructor where a literal says the same.

## Rule Details

`Array(a, b)` and `new Array()` produce what `[a, b]` and `[]` spell out directly, and the constructor's behaviour changes with the number of arguments. This rule reports calls and constructions of `Array` with zero or several arguments. A single argument sets a length, so that form is allowed, and so is a call with type arguments such as `new Array<string>()`, which a literal cannot express. The fix replaces the call with a literal holding the argument text, comments included.

Reimplements [typescript-eslint's `no-array-constructor`](https://typescript-eslint.io/rules/no-array-constructor).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
const empty = new Array()
const pair = Array(1, 2)
```

### ✅ Correct

```ts
const empty = []
const pair = [1, 2]
const slots = new Array(3)
const names = new Array<string>()
```

## Limitations

The rule matches the name `Array` and does not check whether a local binding shadows the global.
