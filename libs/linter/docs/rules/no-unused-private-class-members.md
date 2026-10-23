# no-unused-private-class-members

Forbid `#private` fields, methods and accessors that the class never reads.

## Rule Details

A private member can only be used inside its class, so when the class never reads it, it is dead code: left behind by a refactor, or a sign that a read was written against the wrong name. The rule reports each `#name` member of a class that nothing inside the class reads. Writing to a field does not count as a read, and neither does an increment used as a statement (`this.#count++`) or an assignment through destructuring. For a getter or setter every use counts, since using it runs code. Each private name resolves to the nearest enclosing class that declares it. The rule does not fix.

Reimplements [ESLint's `no-unused-private-class-members`](https://eslint.org/docs/latest/rules/no-unused-private-class-members).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
class Counter {
  #count = 0
  #reset() {}

  increment(): void {
    this.#count++
  }
}
```

### ✅ Correct

```ts
class Counter {
  #count = 0

  increment(): number {
    this.#count += 1
    return this.#count
  }
}
```

## Limitations

Members marked with TypeScript's [`private`](https://www.typescriptlang.org/docs/handbook/2/classes.html#private) modifier are ordinary properties at run time and are not read by this rule.
