# lib-e2e-project-required

Require publishable libraries to have a corresponding e2e project in `apps/package-e2e`.

## Rule Details

This rule ensures every publishable library in the `libs/` folder has a matching e2e test project. The e2e project path is derived from the library's `name` field by removing the `lib-` prefix.

For example: `"name": "lib-time-utils"` → expected e2e at `apps/package-e2e/time-utils/`

A library is considered **publishable** when:

- `projectType` is `"library"`
- Has both `build` and `publish` targets

### Why?

- **Package validation**: E2E tests verify that published packages work correctly when installed from npm
- **Output verification**: Tests cover CJS, ESM, and browser bundle formats
- **Regression prevention**: Catches packaging issues before release

## Examples

### ❌ Incorrect

Library at `libs/utils/my/project.json` without corresponding e2e project:

```json
{
  "name": "lib-my-utils",
  "projectType": "library",
  "targets": {
    "build": {},
    "publish": {}
  }
}
```

**Error**: `Publishable library 'lib-my-utils' is missing a corresponding e2e project. Expected: apps/package-e2e/my-utils/project.json`

### ✅ Correct

Library with `"name": "lib-my-utils"` **with** corresponding `apps/package-e2e/my-utils/project.json`:

```
libs/
  utils/
    my/
      project.json    ← name: "lib-my-utils"
      package.json
      src/
apps/
  package-e2e/
    my-utils/
      project.json    ← Required e2e project
      src/
```

E2E project structure:

```json
{
  "name": "e2e-lib-my-utils",
  "projectType": "application",
  "tags": ["type:e2e", "scope:internal"],
  "targets": {
    "e2e": {
      "executor": "@hyperfrontend/package:e2e",
      "dependsOn": ["^build"],
      "options": {
        "formats": ["cjs", "esm", "browser"]
      }
    }
  },
  "implicitDependencies": ["lib-my-utils"]
}
```

## When Not To Use It

- For non-publishable libraries (internal utilities without npm distribution)
- Projects outside the `libs/` folder

## Related Rules

- [lib-project-metadata](./lib-project-metadata.md)
- [lib-project-bundle-config](./lib-project-bundle-config.md)
- [lib-pkg-fields](./lib-pkg-fields.md)
