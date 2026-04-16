---
name: library-package-config
version: 1.0.0
description: Configure package.json and project.json for hyperfrontend libraries. Use when setting up library configuration, adding entry points, configuring build targets, or fixing ESLint errors about missing fields.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
---

# Library Package Config

Generators create compliant configs. Manual edits must pass these ESLint rules.

---

## ESLint Rules

| Rule                          | Enforces                                                   |
| ----------------------------- | ---------------------------------------------------------- |
| `lib-project-metadata`        | `name` starts with `lib-`, has description + tags          |
| `lib-project-version-targets` | Publishable has `version` + `version-check` targets        |
| `lib-project-bundle-config`   | IIFE/UMD have both `entry` + `globalName`                  |
| `lib-pkg-fields`              | name, description, license, sideEffects, engines, keywords |
| `lib-pkg-no-main`             | No `main` field — use `exports`                            |
| `lib-pkg-exports-js-only`     | Export paths use `.js` not `.ts`                           |
| `lib-pkg-exports-exist`       | Export paths point to existing files                       |
| `lib-pkg-package-json-export` | Exports include `"./package.json"`                         |
| `lib-tsconfig-paths`          | Every export has tsconfig.base.json path mapping           |
| `no-unwanted-barrel-files`    | `index.ts` only at declared entry points                   |
| `lib-readme-structure`        | README has required sections/badges                        |
| `root-readme-packages`        | Root README lists library in packages table                |
| `docs-site-library-docs`      | docs-site has page routes for library markdown             |

---

## Adding Entry Points

```json
// package.json exports
{
  ".": "./src/index.js",
  "./browser": "./src/browser/index.js",
  "./package.json": "./package.json"
}
```

```json
// tsconfig.base.json paths (grouped by package)
{
  "@hyperfrontend/<name>": ["libs/<name>/src/index.ts"],
  "@hyperfrontend/<name>/browser": ["libs/<name>/src/browser/index.ts"]
}
```

Each entry point `index.ts` requires `@module` JSDoc header — see `lib-require-module-header`.

---

## Scope Tags

| Tag              | `private: true` | Has build/publish targets |
| ---------------- | --------------- | ------------------------- |
| `scope:public`   | ✗               | ✓                         |
| `scope:internal` | ✓               | ✗                         |
