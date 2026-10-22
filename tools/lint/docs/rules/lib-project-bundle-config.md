# lib-project-bundle-config

Require entry and globalName fields for bundled outputs (IIFE/UMD) in project.json.

## Rule Details

This rule ensures that when configuring IIFE or UMD bundle outputs in `project.json`, required fields `entry` and `globalName` are both specified.

### Why?

- **Entry point**: Bundlers need to know which file to use as the bundle entry
- **Global name**: Browser bundles need a global variable name (e.g., `window.MyLib`)
- **Completeness**: Prevents incomplete bundle configurations that would fail at build time

## Examples

### ❌ Incorrect

```json
{
  "targets": {
    "build": {
      "options": {
        "iife": {
          "entry": "./browser"
        }
      }
    }
  }
}
```

```json
{
  "targets": {
    "build": {
      "options": {
        "umd": {
          "globalName": "MyLib"
        }
      }
    }
  }
}
```

### ✅ Correct

```json
{
  "targets": {
    "build": {
      "options": {
        "iife": {
          "entry": "./browser",
          "globalName": "MyLib"
        },
        "umd": {
          "entry": "./browser",
          "globalName": "MyLib"
        }
      }
    }
  }
}
```

## When Not To Use It

If you're not producing IIFE or UMD bundles, this rule won't apply.

## Related Rules

- [lib-project-metadata](./lib-project-metadata.md)
- [lib-pkg-bundle-entry](./lib-pkg-bundle-entry.md)
