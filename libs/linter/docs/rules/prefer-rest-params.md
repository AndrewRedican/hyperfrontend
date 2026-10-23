# prefer-rest-params

Require rest parameters instead of the [`arguments`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments) object.

## Rule Details

[`arguments`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments) is an array-like object, not an array, so it lacks the array methods, it hides which parameters a function takes, and arrow functions do not have one of their own. A rest parameter, `(...items)`, is a real array and shows in the signature. The rule reports each use of the implicit [`arguments`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments) inside a function declaration or expression. Reading a property by name, such as [`arguments.length`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments/length), is allowed, and so is a function that declares its own binding called [`arguments`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments). The rule does not fix.

Reimplements [ESLint's `prefer-rest-params`](https://eslint.org/docs/latest/rules/prefer-rest-params).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
function sum() {
  return Array.from(arguments).reduce((total, value) => total + value, 0)
}

function first() {
  return arguments[0]
}
```

### ✅ Correct

```ts
function sum(...values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function count() {
  return arguments.length
}
```
