# no-empty-pattern

Forbid empty destructuring patterns.

## Rule Details

A pattern such as `const {} = options` or `const { a: {} } = options` binds no name at all. It is usually a typo for a default value, `{ a = {} }`. The rule reports every empty object pattern and empty array pattern, in declarations, assignments and parameters alike. The rule does not fix.

Reimplements [ESLint's `no-empty-pattern`](https://eslint.org/docs/latest/rules/no-empty-pattern).

## Options

This rule has no options. The original's [`allowObjectPatternsAsParameters`](https://eslint.org/docs/latest/rules/no-empty-pattern#options) option is not read, so an empty object pattern as a parameter is always reported.

## Examples

### ❌ Incorrect

```ts
const {} = options
const [] = items
const {
  settings: {},
} = options

function start({}) {}
```

### ✅ Correct

```ts
const { settings = {} } = options
const [first] = items

function start({ port }: { port: number }) {}
```
