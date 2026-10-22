# lib-pkg-no-main

Disallow "main" field in publishable library package.json, require "exports" field instead.

## Rule Details

This rule prohibits the use of the legacy `main` field in favor of the modern `exports` field for publishable libraries.

### Why?

- **Modern resolution**: The `exports` field is the modern standard for Node.js package resolution
- **Encapsulation**: `exports` allows you to control exactly what can be imported
- **Conditional exports**: `exports` supports different entry points for ESM/CJS
- **Subpath exports**: `exports` enables clean subpath imports (`@pkg/utils`)

## Examples

### ❌ Incorrect

```json
{
  "main": "./src/index.js"
}
```

### ✅ Correct

```json
{
  "exports": {
    ".": "./src/index.js",
    "./package.json": "./package.json"
  }
}
```

## Fixable

This rule is auto-fixable:

- If `main` exists without `exports`, it will convert `main` to an `exports` field
- If both exist, it will remove the redundant `main` field

## When Not To Use It

If you need to support very old Node.js versions (< 12.7) that don't support the `exports` field.

## Related Rules

- [lib-pkg-fields](./lib-pkg-fields.md)
- [lib-pkg-exports-exist](./lib-pkg-exports-exist.md)
