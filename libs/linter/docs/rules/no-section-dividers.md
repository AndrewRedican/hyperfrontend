# no-section-dividers

Forbid section divider comments drawn with four or more equals signs.

## Rule Details

A banner such as `// ==== Helpers ====` splits a file visually but not structurally, and a file long enough to need one usually wants separate modules, classes or functions instead. The rule reports every line comment containing `====`. When the divider opens a run of consecutive line comments that closes with another divider, as in a banner of three lines, the run is reported as one. The fix removes the divider, or the whole banner, together with the line break that ends it.

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
// ============================
// User Management
// ============================

function createUser() {}

// ==== Helpers ====
function helper() {}
```

### ✅ Correct

```ts
// note: user management
function createUser() {}

function helper() {}
```
