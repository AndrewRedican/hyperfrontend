# no-section-dividers

Disallow artificial section divider comments (comments with 4+ consecutive equals signs).

## Rule Details

This rule flags inline comments that contain 4 or more consecutive equals signs (`====`), which are commonly used to create visual file boundaries or section separators. These artificial dividers add noise and should be replaced with proper code organization techniques like separate files, classes, or functions.

The rule identifies contiguous blocks of line comments that form a divider structure and removes the entire block.

## Examples

### ❌ Incorrect

```ts
// ============================
// User Management Section
// ============================

function createUser() {}

// ==== Helpers ====
function helper() {}
```

### ✅ Correct

```ts
// User management
function createUser() {}

// See helper functions in helpers.ts
function helper() {}
```

## When Not To Use It

If your team has established conventions around visual separators and prefers to keep them, you can disable this rule.

## Options

This rule has no options.

## Fixable

This rule is auto-fixable using `--fix`. The fixer removes the entire contiguous block of comments that contains the section divider.
