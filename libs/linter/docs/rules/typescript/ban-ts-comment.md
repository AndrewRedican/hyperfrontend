# typescript/ban-ts-comment

Forbid `@ts-ignore` and `@ts-nocheck`, and require a description on `@ts-expect-error`.

## Rule Details

A `@ts-` directive changes what the compiler reports, so each one should be deliberate and explained. This rule reports `@ts-ignore` in favour of `@ts-expect-error`, which fails once the line it covers stops erroring. It reports a `@ts-expect-error` whose description is shorter than three characters, counted as graphemes. It reports `@ts-nocheck` only where the compiler honours it, before the first statement of the file, and leaves `@ts-check` alone. It does not fix.

Reimplements [typescript-eslint's `ban-ts-comment`](https://typescript-eslint.io/rules/ban-ts-comment).

## Options

This rule has no options. The [original's options](https://typescript-eslint.io/rules/ban-ts-comment/#options), which allow or require a description per directive, set a description format and change the minimum length, are not read: the behaviour is fixed to the original's defaults.

## Examples

### ❌ Incorrect

```ts
// @ts-ignore
const port: number = '8080'
```

```ts
// @ts-expect-error
const port: number = '8080'
```

### ✅ Correct

```ts
// @ts-expect-error: the fixture checks the runtime guard
const port: number = '8080'
```

## Limitations

The original offers a suggestion that rewrites `@ts-ignore` to `@ts-expect-error`; this rule reports without one.
