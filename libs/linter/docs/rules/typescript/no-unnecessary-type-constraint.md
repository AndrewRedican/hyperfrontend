# typescript/no-unnecessary-type-constraint

Forbid constraining a type parameter to `any` or `unknown`.

## Rule Details

A type parameter without a constraint already accepts every type, so `extends any` and `extends unknown` add nothing but noise. This rule reports every type parameter declared with one of those two constraints, on functions, classes, interfaces, type aliases and methods alike. It does not fix: delete the constraint.

Reimplements [typescript-eslint's `no-unnecessary-type-constraint`](https://typescript-eslint.io/rules/no-unnecessary-type-constraint).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
function first<T extends unknown>(items: T[]): T | undefined {
  return items[0]
}

interface Box<T extends any> {
  value: T
}
```

### ✅ Correct

```ts
function first<T>(items: T[]): T | undefined {
  return items[0]
}

interface Box<T extends object> {
  value: T
}
```

## Limitations

The original offers a suggestion that removes the constraint, keeping `<T,>` in a `.tsx` arrow function; this rule reports without one.
