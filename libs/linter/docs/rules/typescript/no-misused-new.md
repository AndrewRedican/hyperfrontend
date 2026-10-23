# typescript/no-misused-new

Forbid `new` in classes and [`constructor`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/constructor) in interfaces, where the two have been confused.

## Rule Details

A class declares its constructor with [`constructor`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/constructor), and an interface describes construction with a `new` signature. This rule reports an interface construct signature that returns the interface itself, an interface member named [`constructor`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/constructor), and a bodiless class method named `new` that returns the class. Each of these compiles but does not describe what its author meant. It does not fix.

Reimplements [typescript-eslint's `no-misused-new`](https://typescript-eslint.io/rules/no-misused-new).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
interface Point {
  new (x: number, y: number): Point
  constructor(): void
}

declare class Vector {
  new(): Vector
}
```

### ✅ Correct

```ts
interface PointConstructor {
  new (x: number, y: number): Point
}

declare class Vector {
  constructor()
}
```
