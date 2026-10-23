# typescript/adjacent-overload-signatures

Require the overload signatures of a function, method or constructor to sit next to each other.

## Rule Details

Overloads read as one unit only when they are declared together. This rule reports a signature that repeats a name already seen in the same body after some other member came in between. It checks top-level statements, blocks, namespaces, classes, interfaces and type literals, and keeps static and instance members, quoted and bare names, and private names apart. It does not fix.

Reimplements [typescript-eslint's `adjacent-overload-signatures`](https://typescript-eslint.io/rules/adjacent-overload-signatures).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
interface Store {
  get(key: string): string
  set(key: string, value: string): void
  get(key: number): string
}
```

### ✅ Correct

```ts
interface Store {
  get(key: string): string
  get(key: number): string
  set(key: string, value: string): void
}
```
