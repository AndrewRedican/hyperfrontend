# valid-typeof

Require `typeof` to be compared with one of the strings it can produce.

## Rule Details

`typeof` yields one of eight strings: `"undefined"`, `"object"`, `"boolean"`, `"number"`, `"bigint"`, `"string"`, `"symbol"` and `"function"`. A comparison with anything else, usually a misspelling such as `"strnig"` or a guess such as `"array"`, can never hold. The rule reports the other side of an `==`, `===`, `!=` or `!==` comparison with a `typeof` expression when it is a literal, or a template without substitutions, that is not one of those strings, and when it is the global `undefined` rather than the string `"undefined"`. The rule does not fix.

Reimplements [ESLint's `valid-typeof`](https://eslint.org/docs/latest/rules/valid-typeof).

## Options

This rule has no options. The original's [`requireStringLiterals`](https://eslint.org/docs/latest/rules/valid-typeof#options) option is not read, so a comparison with a variable or another expression is never reported.

## Examples

### ❌ Incorrect

```ts
const isText = typeof value === 'strnig'
const isList = typeof value === 'array'
const isMissing = typeof value === undefined
```

### ✅ Correct

```ts
const isText = typeof value === 'string'
const isList = Array.isArray(value)
const isMissing = typeof value === 'undefined'
const isSame = typeof value === typeof other
```

## Limitations

The original offers a suggestion that turns a comparison with `undefined` into one with the string; this rule reports without it.
