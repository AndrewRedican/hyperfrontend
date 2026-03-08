# lib-pkg-package-json-export

Require "./package.json" export in publishable library package.json files for tool compatibility.

## Rule Details

This rule ensures publishable libraries expose `./package.json` as an export. Many tools (bundlers, TypeScript, package managers) need to read package.json metadata.

### Why?

- **Tooling compatibility**: Many tools need to read `package.json` at runtime
- **Version detection**: Libraries often need to read their own version
- **Metadata access**: Frameworks may need to access package metadata
- **Modern Node.js**: With `exports`, anything not explicitly exported is inaccessible

## Examples

### ❌ Incorrect

```json
{
  "exports": {
    ".": "./src/index.js"
  }
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

## When Not To Use It

If you're certain no consumer or tool will ever need to access your package.json file programmatically.

## Related Rules

- [lib-pkg-fields](./lib-pkg-fields.md)
- [lib-pkg-exports-exist](./lib-pkg-exports-exist.md)
