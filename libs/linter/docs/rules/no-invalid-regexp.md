# no-invalid-regexp

Forbid `RegExp(...)` calls with a pattern or flags the engine refuses.

## Rule Details

A regular expression literal with a syntax error fails to parse, so the problem shows up at once. A pattern passed to `RegExp` as a string is only checked when the call runs, where it throws. The rule reads `RegExp(...)` and `new RegExp(...)` calls whose arguments are string literals and reports:

- flags the language does not know, a flag given twice, or `u` and `v` together;
- a pattern the engine refuses under the flags given, with the engine's reason in the message.

When the flags are not a string literal, the pattern is reported only if no choice of flags would accept it. `RegExp` is recognised when it names the global, is reached through the global object, or is held in a constant. The rule does not fix.

Reimplements [ESLint's `no-invalid-regexp`](https://eslint.org/docs/latest/rules/no-invalid-regexp).

## Options

This rule has no options. The original's [`allowConstructorFlags`](https://eslint.org/docs/latest/rules/no-invalid-regexp#options) option is not read, so a flag the language does not know is always reported.

## Examples

### ❌ Incorrect

```ts
const unclosed = new RegExp('[')
const unknownFlag = RegExp('.', 'z')
const both = new RegExp('a', 'uv')
```

### ✅ Correct

```ts
const word = new RegExp('\\w+', 'g')
const dynamic = new RegExp(pattern, flags)
```
