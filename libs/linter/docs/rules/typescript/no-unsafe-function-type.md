# typescript/no-unsafe-function-type

Forbid the global `Function` type.

## Rule Details

The built-in `Function` type accepts any callable, including classes, and types every call through it as returning `any`, so neither the arguments nor the result are checked. This rule reports `Function` used as a type, and in the `extends` of an interface or the `implements` of a class, when it refers to the global. A type named `Function` that the file declares or imports itself passes. It does not fix: write a function type with its parameters and return type.

Reimplements [typescript-eslint's `no-unsafe-function-type`](https://typescript-eslint.io/rules/no-unsafe-function-type).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
function retry(task: Function, times: number) {
  return task
}
```

### ✅ Correct

```ts
function retry(task: () => Promise<void>, times: number) {
  return task
}
```
