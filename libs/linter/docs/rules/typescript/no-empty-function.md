# typescript/no-empty-function

Forbid functions whose body is empty.

## Rule Details

An empty function body is either unfinished work or a deliberate no-op, and a reader cannot tell which. This rule reports a function declaration, function expression, arrow function, method, getter, setter or constructor whose block body holds neither a statement nor a comment. A comment inside the body, such as one saying why nothing happens, is enough to pass. A constructor that declares parameter properties passes too, since its parameter list does the work. It does not fix.

Reimplements [typescript-eslint's `no-empty-function`](https://typescript-eslint.io/rules/no-empty-function).

## Options

This rule has no options. The [original's options](https://typescript-eslint.io/rules/no-empty-function/#options), a list of function kinds to allow, are not read: every kind is checked.

## Examples

### ❌ Incorrect

```ts
function noop() {}

class Store {
  reset() {}
}
```

### ✅ Correct

```ts
function noop() {
  // intentionally empty: callers pass it where a handler is required
}

class Store {
  constructor(private readonly name: string) {}
}
```
