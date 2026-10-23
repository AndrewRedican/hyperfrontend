# typescript/no-duplicate-enum-values

Forbid two members of one enum from having the same literal value.

## Rule Details

An enum member that repeats another's value is almost always a copied line that was not edited, and it makes the two names indistinguishable at run time. This rule reports every member whose initializer repeats a value seen earlier in the same enum. Values are compared when they are string or number literals, templates without substitutions, or numbers under a unary plus or minus. Strings and numbers never collide with each other, and `-0` is distinct from `0`. Members without initializers and computed values are not compared. It does not fix.

Reimplements [typescript-eslint's `no-duplicate-enum-values`](https://typescript-eslint.io/rules/no-duplicate-enum-values).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
enum Status {
  Active = 'active',
  Paused = 'active',
}
```

### ✅ Correct

```ts
enum Status {
  Active = 'active',
  Paused = 'paused',
}
```
