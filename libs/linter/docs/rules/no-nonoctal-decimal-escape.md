# no-nonoctal-decimal-escape

Forbid the escapes `\8` and `\9` in string literals.

## Rule Details

`\8` and `\9` look like octal escapes but escape nothing: in sloppy-mode code they stand for the digits `8` and `9`, and in strict code they are a syntax error. They are usually a typo for an octal or a `\x` escape, or a backslash that was meant to be doubled. The rule reports each `\8` and `\9` in a string literal, skipping a backslash that is itself escaped (`'\\8'`).

This linter's parser refuses `\8` and `\9` in JavaScript and TypeScript string literals, so such code is reported as a parsing error before any rule runs. The rule reports in the one place the parser lets them through: the quoted value of a JSX attribute, where backslashes are not escapes and the text is taken as written. The rule does not fix.

Reimplements [ESLint's `no-nonoctal-decimal-escape`](https://eslint.org/docs/latest/rules/no-nonoctal-decimal-escape).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```tsx
const label = <input pattern="\8" />
```

### ✅ Correct

```ts
const digit = '8'
const escaped = '\\8'
```

## Limitations

The original offers suggestions that rewrite the escape as the digit or as a `\u` escape; this rule reports without them.
