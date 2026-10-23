# no-decorative-header-comments

Forbid a file from opening with a block comment of prose alone that documents nothing.

## Rule Details

A header such as "File: utils.ts, Description: utility functions" repeats what the file name and the code already say, and goes stale. The rule reads the first comment of a file, when nothing but whitespace precedes it, and reports it when it is a block comment of two or more lines that:

- carries no tag (no line opens with `@`, so `@module`, `@packageDocumentation` and tooling directives such as `@vitest-environment jsdom` are kept), and
- documents no declaration: a blank line separates it from the code, nothing follows it, or the code that follows does not open with a declaration keyword such as `export`, `function`, `const` or `class`.

A one-line block comment and a line comment are left alone. The fix removes the comment and the whitespace after it.

## Options

This rule has no options.

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
/*
 * File: utils.ts
 * Description: Utility functions for the application
 */
describe('utils', () => {})
```

### ✅ Correct

```ts
/**
 * Virtual file system utilities.
 *
 * @module vfs
 */

export function createVfs() {}
```

```ts
/**
 * Creates an empty virtual file system.
 * Paths are POSIX.
 */
export function createVfs() {}
```

```ts
/**
 * @vitest-environment jsdom
 */
describe('DOM tests', () => {})
```
