# no-empty-static-block

Forbid empty class static blocks, `static {}`.

## Rule Details

A class `static { }` block with nothing in it does nothing, and is usually left over from removed initialisation code or an unfinished change. The rule reports a static block with no statements. A comment inside the braces says the emptiness is intended, and the block is then left alone. The rule does not fix.

Reimplements [ESLint's `no-empty-static-block`](https://eslint.org/docs/latest/rules/no-empty-static-block).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
class Registry {
  static {}
}
```

### ✅ Correct

```ts
class Registry {
  static entries: string[] = []
  static {
    Registry.entries.push('default')
  }
}

class Placeholder {
  static {
    // intentionally empty
  }
}
```
