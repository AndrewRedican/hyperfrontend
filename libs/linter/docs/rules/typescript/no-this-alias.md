# typescript/no-this-alias

Forbid copying `this` into a variable.

## Rule Details

Storing `this` in a variable such as self or that is a habit from before arrow functions, which keep the surrounding `this` without a copy. This rule reports a variable declaration or an assignment whose target is a plain identifier and whose value is `this`. Destructuring members out of `this` passes. It does not fix.

Reimplements [typescript-eslint's `no-this-alias`](https://typescript-eslint.io/rules/no-this-alias).

## Options

This rule has no options. The [original's options](https://typescript-eslint.io/rules/no-this-alias/#options), which forbid destructuring and allow chosen alias names, are not read: destructuring always passes and no name is allowed.

## Examples

### ❌ Incorrect

```ts
class Timer {
  start() {
    const self = this
    setTimeout(function () {
      self.tick()
    }, 1000)
  }
}
```

### ✅ Correct

```ts
class Timer {
  start() {
    const { tick } = this
    setTimeout(() => this.tick(), 1000)
  }
}
```
