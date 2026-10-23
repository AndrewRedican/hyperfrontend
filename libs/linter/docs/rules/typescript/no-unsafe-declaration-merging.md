# typescript/no-unsafe-declaration-merging

Forbid a class and an interface of the same name in one scope.

## Rule Details

When a class and an interface share a name, TypeScript merges them: the interface's members join the class's type, but the class never has to implement them, so the compiler accepts calls that fail at run time. This rule reports both declarations of such a pair. A class whose name is merged only with a namespace, or an interface merged only with another interface, passes. It does not fix.

Reimplements [typescript-eslint's `no-unsafe-declaration-merging`](https://typescript-eslint.io/rules/no-unsafe-declaration-merging).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
interface Logger {
  flush(): void
}

class Logger {
  log(message: string) {
    return message
  }
}
```

### ✅ Correct

```ts
interface Flushable {
  flush(): void
}

class Logger implements Flushable {
  flush() {
    return undefined
  }
}
```
