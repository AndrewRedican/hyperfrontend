# project-lifecycle-policy

Hold projects to the policy their declared lifecycle state carries.

## Rule Details

A project declares where it sits in its life through `metadata.lifecycle.state` in its
`project.json`. This rule reads that state and enforces whatever policy the ESLint configuration
attaches to it.

```jsonc
{
  "name": "demo-koi-pond",
  "metadata": {
    "deploy": { "provider": "railway" },
    "lifecycle": {
      "state": "frozen",
      "since": "2026-08-25",
      "reason": "Shipped demonstration; its behaviour is the exhibit the docs site embeds.",
    },
  },
}
```

### States

| State     | Meaning                                                                             |
| --------- | ----------------------------------------------------------------------------------- |
| `planned` | The slot is reserved and the demo is catalogued, but nothing is implemented         |
| `active`  | Under development, full rigour. **The default when `metadata.lifecycle` is absent** |
| `frozen`  | Complete and deployed. Do not add process, do not modify without the owner's say-so |
| `retired` | Kept for reference, not deployed, not built                                         |

`active` being the absent value is what keeps the rule cheap: a project that declares no lifecycle
returns from `create()` before reading anything, so every library, tool and e2e project falls out on
the first check with no configuration needed.

### Why?

A finished demonstration is an artefact, not living code. Every test, lint target, linter config and
dev dependency added to one is pure maintenance cost that buys nothing, and it is exactly the sort of
sprawl that accumulates by reflex: a spec written for code someone just read, a lint config restored
because it looked missing. The rule makes that drift fail loudly instead of accumulating quietly.

## Options

A single object with a `states` map. Each key is a lifecycle state; each value is the policy for
projects declaring it. A state with no entry is unconstrained.

| Option                  | Type       | Applies to     | Description                                                            |
| ----------------------- | ---------- | -------------- | ---------------------------------------------------------------------- |
| `forbiddenTargets`      | `string[]` | `project.json` | Nx target names the project must not declare. `*` wildcards allowed    |
| `forbiddenScripts`      | `string[]` | `package.json` | Script names the project must not declare. `*` wildcards allowed       |
| `forbiddenDependencies` | `string[]` | `package.json` | Package names forbidden in any dependency field. `*` wildcards allowed |
| `forbiddenFiles`        | `string[]` | `project.json` | Project-relative globs that must not exist. `*` and `**` supported     |
| `forbidNpmPublishing`   | `boolean`  | both           | Require the project to be shaped as one never published to npm         |

`forbiddenFiles` walks the project directory, never descending into `node_modules`, `dist`,
`coverage`, `.git`, `.nx`, `out` or `.next`: build output mirrors source, so walking it would report
the same violation twice under a path nobody edits.

### `forbidNpmPublishing` governs the npm registry, never deployment

It checks three things and nothing else:

- no `publish`, `version` or `version-check` Nx target
- `package.json` sets `"private": true`
- `package.json` declares no `publishConfig`

It does **not** touch deployment. A frozen application both can and should build and deploy; a frozen
library can still be built and consumed locally through `npm pack` and a `file:` dependency, which
npm permits on a private package. `build`, `version`, `files` and `exports` fields are never
inspected.

## Fixes and suggestions

The rule declares `hasSuggestions` and deliberately **not** `fixable`. Its purpose is to make a
person stop and think about a project that was declared finished, which an autofix silently
rewriting the manifest would defeat.

| Diagnostic                                                                         | Offered as                                                                                                                             |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `forbiddenTarget`, `forbiddenScript`, `publishingTarget`, `forbiddenPublishConfig` | Suggestion: remove the property                                                                                                        |
| `missingPrivate` with `"private": false`                                           | Suggestion: set it to `true`                                                                                                           |
| `forbiddenDependency`                                                              | Message only. Removing it in `package.json` alone would leave `package-lock.json` stale, so the correct remediation is `npm uninstall` |
| `forbiddenFile`                                                                    | Message only. The offending file is not the file being linted, and an ESLint fixer can only edit the latter                            |

## Examples

### ❌ Incorrect

A frozen project declaring a lint target:

```json
{
  "metadata": { "lifecycle": { "state": "frozen" } },
  "targets": { "build": {}, "lint": {} }
}
```

**Error**: `A 'frozen' project must not declare the 'lint' target.`

A frozen project's `package.json` carrying a test runner:

```json
{
  "private": true,
  "devDependencies": { "vitest": "4.1.10" }
}
```

**Error**: `A 'frozen' project must not depend on 'vitest'. Remove it with npm uninstall vitest so package-lock.json stays in step.`

### ✅ Correct

```json
{
  "metadata": { "lifecycle": { "state": "frozen" } },
  "targets": { "install": {}, "dev": {}, "build": {}, "typecheck": {}, "audit": {} }
}
```

## Configuration

Enabled from the root `eslint.config.cjs`, because the projects it governs deliberately have no lint
target of their own:

```js
{
  files: ['**/project.json', '**/package.json'],
  languageOptions: { parser: require('jsonc-eslint-parser') },
  rules: {
    'workspace/project-lifecycle-policy': ['error', {
      states: {
        frozen: {
          forbiddenTargets: ['lint', 'test', 'e2e'],
          forbiddenScripts: ['lint', 'lint:*', 'test', 'test:*'],
          forbiddenDependencies: ['eslint', 'oxlint', 'vitest', 'jest'],
          forbiddenFiles: ['**/*.spec.*', 'eslint.config.*'],
          forbidNpmPublishing: true,
        },
      },
    }],
  },
}
```

The root lint target must also list the manifests in its `lintFilePatterns`. ESLint 9 flat config
will not expand a `**` glob onto a non-JS extension, so those patterns are single-star and
depth-explicit (`apps/*/project.json`, `apps/*/*/project.json`, and so on).

## Related Rules

- [lib-project-metadata](./lib-project-metadata.md): required metadata on publishable libraries
- [no-vscode-config](./no-vscode-config.md): the other guard against per-project tooling sprawl
