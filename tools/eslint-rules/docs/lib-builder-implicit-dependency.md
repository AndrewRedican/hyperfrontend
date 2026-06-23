# lib-builder-implicit-dependency

Require build-tooling projects in `implicitDependencies` for libraries that define a `build` target.

## Rule Details

Every library that defines a `build` target in `project.json` is built by the `@hyperfrontend/package:build` executor. That executor (project `tool-package`) imports `@hyperfrontend/builder` (project `lib-builder`) to produce the package output. Both imports resolve through `tsconfig.base.json` path aliases to **raw source** (`tools/package/src`, `libs/builder/src`) — not a published npm package.

Because the build consumes that raw source, any change to `lib-builder` or `tool-package` can materially change a library's build output. This rule requires each affected library to declare both projects in `implicitDependencies` so Nx adds the edge to its project graph — making `nx affected` rebuild the library and folding the tooling source into the build cache hash.

### Why `implicitDependencies` (not `dependsOn`)?

- **`implicitDependencies`** (project level) adds a project-graph edge where no code import is detected. It drives `nx affected` and cache invalidation. This is the correct mechanism here.
- **`dependsOn`** (target level) only orders tasks ("build lib-builder before me"). The build reads lib-builder's _source_, not its compiled output, so there is no artifact to order against.

### Scope

The rule applies to a `project.json` only when:

- `projectType` is `"library"`, **and**
- a `build` target is defined.

The build-tooling projects themselves (`lib-builder`, `tool-package`) are skipped — `tool-package` already depends on `lib-builder`, so declaring the reverse edge would create a graph cycle.

## Status

This rule is configured **`error`**. `@hyperfrontend/builder` is not a published npm package — it is resolved entirely from raw TS source through `tsconfig.base.json` path aliases. Using an executor does **not** create a project-graph edge from the consuming library to the executor's plugin, so without an explicit `implicitDependencies` entry Nx would not invalidate a library's cached build when the tooling source changes. The implicit dependency is therefore required.

If the build is ever changed to consume a version-pinned `@hyperfrontend/builder` from `node_modules`, the lockfile already gates cache invalidation and this rule can be relaxed to `'off'`.

## Examples

### ❌ Incorrect

```json
{
  "name": "lib-example",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@hyperfrontend/package:build"
    }
  }
}
```

```json
{
  "name": "lib-example",
  "projectType": "library",
  "targets": { "build": {} },
  "implicitDependencies": ["lib-builder"]
}
```

### ✅ Correct

```json
{
  "name": "lib-example",
  "projectType": "library",
  "targets": { "build": {} },
  "implicitDependencies": ["lib-builder", "tool-package"]
}
```

Unrelated implicit dependencies are preserved; the tooling projects are appended:

```json
{
  "name": "lib-example",
  "projectType": "library",
  "targets": { "build": {} },
  "implicitDependencies": ["lib-other", "lib-builder", "tool-package"]
}
```

## Autofix

This rule is fixable. The autofix:

- **Adds** an `implicitDependencies` array with `["lib-builder", "tool-package"]` when the field is absent.
- **Appends** only the missing tooling project(s), preserving existing entries, when the field already exists.

A non-array `implicitDependencies` value is reported without an autofix.
