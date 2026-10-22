# lib-project-compatibility

Validate the `metadata.compatibility` block of a publishable library `project.json`.

## Rule Details

Every publishable library declares where it runs, once, in its own `project.json`:

```json
{
  "metadata": {
    "compatibility": {
      "environments": {
        "node": "full",
        "browser": "full",
        "webWorker": "full"
      },
      "note": "Optional prose about the caveats."
    }
  }
}
```

That declaration is the only source for the compatibility row the docs site draws, so a block that is missing, misspelled or self-contradicting turns into a published claim that is wrong. The docs build already refuses to render a malformed block, but it refuses late, after the change is merged. This rule moves the same check to lint time.

The environments are exactly `node`, `browser` and `webWorker`. The support levels are exactly `full`, `partial` and `none`. All three environments must be declared, because an environment left out reads as unsupported rather than as undecided.

### What the rule reports

| Message                       | Reported when                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `missingCompatibility`        | A publishable library declares no `metadata.compatibility` at all.             |
| `missingEnvironments`         | The compatibility block carries no `environments` object.                      |
| `missingEnvironment`          | One of `node`, `browser`, `webWorker` is absent from `environments`.           |
| `unknownEnvironment`          | `environments` carries a key that is not one of the three runtimes.            |
| `invalidSupport`              | A runtime is declared at something other than `full`, `partial` or `none`.     |
| `invalidNote`                 | `note` is present but is not a non-empty string.                               |
| `unknownCompatibilityKey`     | The compatibility block carries a field other than `environments` and `note`.  |
| `workerWithoutBrowser`        | `webWorker` is `full` or `partial` while `browser` is `none`.                  |
| `runsNowhere`                 | All three runtimes are declared `none`.                                        |
| `browserBundleWithoutBrowser` | The build target produces an `iife` or `umd` bundle while `browser` is `none`. |

The last three are contradictions: each declaration is legal on its own, but they cannot all be true at once. A Web Worker is a browser runtime, so worker support without browser support is impossible. A package that supports no runtime runs nowhere. An IIFE or UMD bundle exists only for a browser or a CDN consumer to load, so building one while denying browser support means one of the two statements is wrong.

Nothing here is auto-fixable. Only a human knows which half of a contradiction is the truth.

## Examples

### ❌ Incorrect

A publishable library that says nothing about where it runs:

```json
{
  "name": "lib-utils",
  "projectType": "library",
  "targets": { "build": {}, "publish": {} }
}
```

A misspelled support level:

```json
{
  "metadata": {
    "compatibility": {
      "environments": { "node": "yes", "browser": "none", "webWorker": "none" }
    }
  }
}
```

A runtime left out:

```json
{
  "metadata": {
    "compatibility": {
      "environments": { "node": "full", "webWorker": "none" }
    }
  }
}
```

Worker support claimed while the browser is denied:

```json
{
  "metadata": {
    "compatibility": {
      "environments": { "node": "full", "browser": "none", "webWorker": "full" }
    }
  }
}
```

A browser bundle built for a browser the package says it does not support:

```json
{
  "metadata": {
    "compatibility": {
      "environments": { "node": "full", "browser": "none", "webWorker": "none" }
    }
  },
  "targets": {
    "build": {
      "options": {
        "iife": { "entry": ".", "globalName": "Utils" }
      }
    }
  }
}
```

### ✅ Correct

A package that runs everywhere:

```json
{
  "metadata": {
    "compatibility": {
      "environments": { "node": "full", "browser": "full", "webWorker": "full" }
    }
  }
}
```

Node-only tooling, shipping no browser bundle:

```json
{
  "metadata": {
    "compatibility": {
      "environments": { "node": "full", "browser": "none", "webWorker": "none" }
    }
  }
}
```

Uneven support, explained in a note:

```json
{
  "metadata": {
    "compatibility": {
      "environments": {
        "node": "full",
        "browser": "full",
        "webWorker": "partial"
      },
      "note": "Support is per entry point: the host entry needs a DOM, the root entry runs anywhere."
    }
  }
}
```

## Options

This rule has no configurable options.

## When Not To Use It

This rule is specific to the hyperfrontend monorepo, where the docs site reads `metadata.compatibility` to draw a per-package compatibility row. It applies only to publishable libraries, so applications, e2e projects and internal libraries are skipped whether or not they carry a metadata block. Turn it off in a workspace that documents runtime support somewhere other than `project.json`.

## Related Rules

- [lib-project-metadata](./lib-project-metadata.md) - Requires the other essential fields of a publishable library's project.json
- [lib-project-bundle-config](./lib-project-bundle-config.md) - Checks the IIFE and UMD options this rule cross-references
