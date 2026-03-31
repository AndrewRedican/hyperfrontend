# no-decorative-header-comments

Disallow decorative file header block comments that lack meaningful JSDoc tags.

## Rule Details

This rule flags `/** ... */` block comments at the top of a file that serve as decorative headers rather than legitimate documentation. These comments typically contain prose descriptions without meaningful JSDoc tags like `@module`, `@param`, etc.

Legitimate JSDoc comments that include proper tags are allowed. The rule distinguishes between:

- **Decorative headers**: Prose-only multi-line comments describing the file
- **Legitimate JSDoc**: Comments with `@module`, `@param`, `@returns`, and other standard tags
- **Tooling directives**: Comments like `@jest-environment jsdom`

## Examples

### ❌ Incorrect

```ts
/**
 * This is the vfs module.
 * It provides virtual file system utilities.
 */
export function createVfs() {}
```

```ts
/**
 * File: utils.ts
 * Description: Utility functions for the application
 * Author: Someone
 */
export const utils = {}
```

### ✅ Correct

```ts
/**
 * @module vfs
 * Provides virtual file system utilities.
 */
export function createVfs() {}
```

```ts
/**
 * @jest-environment jsdom
 */
describe('DOM tests', () => {})
```

```ts
// File-level comment as line comment is fine
export const utils = {}
```

## When Not To Use It

If your project has legacy files with decorative headers that you don't want to refactor, you can disable this rule for those files or globally.

## Options

This rule has no options.

## Fixable

This rule is auto-fixable using `--fix`. The fixer removes the decorative header comment entirely.
