# lib-pkg-exports-js-only

Require only .js or .json extensions for relative paths in package.json exports field.

## Rule Details

This rule ensures that all relative paths in the `exports` field use compiled JavaScript extensions (`.js`, `.mjs`, `.cjs`) or `.json`, not TypeScript source extensions.

### Why?

- **Compatibility**: Consumers expect compiled JavaScript, not TypeScript
- **Node.js resolution**: Node.js resolves exports literally without automatic extension mapping
- **Best practice**: Package exports should reference distributable files

## Examples

### ❌ Incorrect

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./utils": "./src/utils.tsx"
  }
}
```

### ✅ Correct

```json
{
  "exports": {
    ".": "./src/index.js",
    "./utils": "./src/utils.js",
    "./package.json": "./package.json"
  }
}
```

## Fixable

This rule provides auto-fix suggestions:

- `.ts` → `.js`
- `.mts` → `.mjs`
- `.cts` → `.cjs`

## When Not To Use It

If you publish TypeScript source directly (rare, but some packages do this for Deno compatibility).

## Related Rules

- [lib-pkg-exports-exist](./lib-pkg-exports-exist.md)
- [lib-pkg-bundle-entry](./lib-pkg-bundle-entry.md)
