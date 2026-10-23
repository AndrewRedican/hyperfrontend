# no-unexpected-multiline

Forbid line breaks that make the next line continue the previous expression by accident.

## Rule Details

Without semicolons, a line that starts with `(`, `[` or a template literal does not start a new statement: it continues the one before it as a call, a property access or a tagged template, which is rarely what the line break meant. The rule reports:

- a call whose `(` starts a new line after the callee, when the call has arguments;
- a computed member access whose `[` starts a new line after the object;
- a tagged template whose literal starts a new line after the tag;
- a division whose operators would read as a regular expression with flags, as in a line `/foo/g.test(x)` after an expression.

Optional calls and accesses (`?.(` and `?.[`) are not reported. Put a semicolon at the start of the continued line, or join the lines when the continuation is meant. The rule does not fix.

Reimplements [ESLint's `no-unexpected-multiline`](https://eslint.org/docs/latest/rules/no-unexpected-multiline).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

<!-- prettier-ignore -->
```ts
const value = load
(source).trim()

const first = items
[0].name
```

### ✅ Correct

<!-- prettier-ignore -->
```ts
const value = load
;(source).trim()

const first = items[0].name
```
