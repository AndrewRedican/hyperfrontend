# no-octal

Forbid legacy octal number literals such as `071`.

## Rule Details

A number written with a leading zero, such as `071`, is read as octal in sloppy-mode code, so it stands for 57 while most readers see seventy-one, and `08` silently falls back to decimal. In strict code, which includes every module and class body, such literals are a syntax error. Write `0o71` for an octal value or drop the leading zero for a decimal one.

This linter's parser refuses legacy octal literals in every file, scripts included, so code that holds one fails to parse and is reported as a parsing error before any rule runs. The rule therefore never reports by itself; it exists so that a configuration ported from ESLint keeps the same rule id and the same intent.

Reimplements [ESLint's `no-octal`](https://eslint.org/docs/latest/rules/no-octal).

## Options

This rule has no options.

## Examples

A legacy octal literal such as `0755` fails to parse before any rule runs, so the file is reported as a parsing error rather than by this rule.

### ✅ Correct

```ts
const permissions = 0o755
const count = 71
```
