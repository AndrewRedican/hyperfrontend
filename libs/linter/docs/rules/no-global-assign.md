# no-global-assign

Forbid assigning to read-only globals such as `Object`, `undefined` or `window`.

## Rule Details

Overwriting a built-in global breaks every other piece of code that relies on it, and in strict code assigning to one such as `undefined` throws. The rule reports every write, an assignment, an update such as `++` or a destructuring target, to a global variable that is read-only: the language's built-ins, and the globals the configuration declares as read-only through its language settings. A local variable that shadows the global is not reported. The rule does not fix.

Reimplements [ESLint's `no-global-assign`](https://eslint.org/docs/latest/rules/no-global-assign).

## Options

| Option                   | Type       | Default | Meaning                                                       |
| ------------------------ | ---------- | ------- | ------------------------------------------------------------- |
| [`exceptions`](#options) | `string[]` | `[]`    | Names of read-only globals that may be assigned all the same. |

## Examples

### ❌ Incorrect

```ts
Object = null
undefined = 1
```

### ✅ Correct

```ts
let Object = null
const value = undefined
```

### ✅ Correct, with { "exceptions": ["Object"] }

<!-- options: {"exceptions": ["Object"]} -->

```ts
Object = null
```
