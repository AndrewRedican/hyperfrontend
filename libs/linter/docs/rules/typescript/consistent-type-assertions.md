# typescript/consistent-type-assertions

Require type assertions to be written `value as Type` rather than `<Type>value`.

## Rule Details

The angle-bracket form reads like JSX and cannot be written in a `.tsx` file at all, so one assertion style keeps code portable between the two. This rule reports every angle-bracket assertion. The fix rewrites it to the `as` form and keeps the meaning: it parenthesises the value when the value binds no tighter than `as`, and parenthesises the whole assertion when the surrounding expression binds at least as tight, unless it already sits in parentheses of its own.

Reimplements [typescript-eslint's `consistent-type-assertions`](https://typescript-eslint.io/rules/consistent-type-assertions).

## Options

This rule has no options. The [original's options](https://typescript-eslint.io/rules/consistent-type-assertions/#options), which choose the angle-bracket style or forbid assertions, and restrict assertions on object and array literals, are not read: the style is fixed to `as` and literals are not checked.

## Examples

### ❌ Incorrect

```ts
const input = <HTMLInputElement>event.target
const total = <number>(a ?? b) + 1
```

### ✅ Correct

```ts
const input = event.target as HTMLInputElement
const total = ((a ?? b) as number) + 1
```
