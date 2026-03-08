# lib-pkg-exports-exist

Require that paths in package.json exports field point to existing files.

## Rule Details

This rule validates that all paths specified in the `exports` field of `package.json` point to files that actually exist (or will exist after compilation). For `.js` exports, it also checks for corresponding `.ts` source files.

### Why?

- **Correctness**: Prevents broken exports that would fail at runtime
- **Early detection**: Catches typos and missing files during linting
- **Confidence**: Ensures the published package has valid entry points

## Examples

### ❌ Incorrect

```json
{
  "exports": {
    ".": "./src/index.js",
    "./utils": "./src/nonexistent.js"
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

## How It Works

For `.js`, `.mjs`, or `.cjs` exports, the rule checks for:

1. The exact file path
2. A corresponding TypeScript source file (`.ts`, `.mts`, `.cts`)

This accommodates the common pattern where `exports` points to compiled output that doesn't exist until build time.

## When Not To Use It

If you generate export paths dynamically or have a non-standard build process.

## Related Rules

- [lib-pkg-bundle-entry](./lib-pkg-bundle-entry.md)
- [lib-pkg-exports-js-only](./lib-pkg-exports-js-only.md)
