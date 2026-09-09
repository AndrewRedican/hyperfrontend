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

Each entry point `index.ts` requires a `@module` JSDoc header — see `lib-require-module-header`.

---

## Module Headers

The description above `@module` is what a reader sees beside the module in the generated API docs. It answers one question: **what capability or responsibility does this module expose?**

- One or two sentences, **200 characters maximum** (the description only; tags are not counted).
- Name the capability, not the implementation. No walkthroughs, no bullet lists, no miniature README.
- Say something the path does not. "Nx `serve` executor entry point" for `.../nx/executors/serve` is not a description.
- Detail belongs where a reader goes looking for it: the package README, the entry point's own README, or the JSDoc on the symbols themselves.

```typescript
// ❌ restates the path
/**
 * Nx `serve` executor entry point.
 *
 * @module @hyperfrontend/features/nx/executors/serve
 */

// ❌ explains how it works
/**
 * Dev server, debug UI, and production static server for feature apps.
 *
 * Serves each app's compiled output on its own port and hosts the in-browser
 * debug UI (display-mode, resize, message-log, and security controls) at the
 * root of a control server. The same static core also powers `hf serve`, ...
 *
 * @module @hyperfrontend/features/server
 */

// ✅ names the capability
/**
 * Serves feature apps: one static server per app, the in-browser debug UI that
 * drives them, and the production static server behind `hf serve`.
 *
 * @module @hyperfrontend/features/server
 */
```

`lib-require-module-header` enforces the mechanical part: a description exists, it fits the ceiling, it clears the floor, and it carries words the module path does not. It cannot judge whether a sentence is worth reading — that part is yours.

---

## Scope Tags

| Tag              | `private: true` | Has build/publish targets |
| ---------------- | --------------- | ------------------------- |
| `scope:public`   | ✗               | ✓                         |
| `scope:internal` | ✓               | ✗                         |
