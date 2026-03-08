# lib-pkg-bundle-entry

Require bundled output entries to exist in package.json exports.

## Rule Details

This rule ensures that bundle entries specified in `project.json` (IIFE/UMD builds) are properly exported in `package.json`. This prevents bundled outputs from being inaccessible to consumers.

### Why?

- **Discoverability**: Consumers need to know which bundle formats are available
- **Tooling**: Package managers and bundlers rely on the exports field
- **Consistency**: Ensures build configuration and package exports stay in sync

## Examples

### ❌ Incorrect

**project.json:**

```json
{
  "targets": {
    "build": {
      "options": {
        "iife": { "entry": "./browser" }
      }
    }
  }
}
```

**package.json:**

```json
{
  "exports": {
    ".": "./src/index.js"
  }
}
```

### ✅ Correct

**project.json:**

```json
{
  "targets": {
    "build": {
      "options": {
        "iife": { "entry": "./browser" }
      }
    }
  }
}
```

**package.json:**

```json
{
  "exports": {
    ".": "./src/index.js",
    "./browser": "./dist/browser.iife.js"
  }
}
```

## When Not To Use It

If your library doesn't produce bundled outputs (IIFE/UMD), this rule won't apply.

## Related Rules

- [lib-pkg-exports-exist](./lib-pkg-exports-exist.md)
- [lib-pkg-exports-js-only](./lib-pkg-exports-js-only.md)
