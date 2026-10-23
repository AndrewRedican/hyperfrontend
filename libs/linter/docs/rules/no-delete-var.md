# no-delete-var

Forbid the `delete` operator on a variable.

## Rule Details

`delete` removes properties from objects. Applied to a plain variable name it does nothing in sloppy-mode code and returns `false`, and in strict code, which includes every module, it is a syntax error. The rule reports a `delete` whose operand is a bare identifier. To clear a variable, assign `undefined` to it. The rule does not fix.

Reimplements [ESLint's `no-delete-var`](https://eslint.org/docs/latest/rules/no-delete-var).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
var cache = {}
delete cache
```

### ✅ Correct

```ts
const cache: Record<string, number> = { hits: 1 }
delete cache.hits
```
