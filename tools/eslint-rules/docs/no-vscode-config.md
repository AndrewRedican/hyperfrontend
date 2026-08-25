# no-vscode-config

Keep VS Code configuration in the devcontainer rather than in `.vscode` directories.

## Rule Details

`.devcontainer/devcontainer.json` owns both halves of VS Code configuration for this workspace,
under `customizations.vscode`:

```jsonc
{
  "customizations": {
    "vscode": {
      "extensions": ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode"],
      "settings": { "editor.formatOnSave": true },
    },
  },
}
```

This rule reports every `.vscode` directory in the workspace, the root one included. It runs once,
from the workspace's root `package.json`: a `package.json` anywhere else returns immediately, so the
sweep happens a single time rather than once per project.

The walk never descends into `node_modules`, `.git`, `dist`, `coverage`, `tmp`, `out`, `.next`,
`.nx`, `.angular`, `.verdaccio`, `.claude` or `_`.

### Why?

- **One source of truth.** Extensions and settings described in two places drift, and this workspace
  had already reached the point where a root `.vscode/settings.json` duplicated a `files.watcherExclude`
  block the devcontainer also declared.
- **No decision to make.** A single owning file means nobody has to work out which file a new setting
  belongs in. That decision is the entire recurring cost of a split source of truth.
- **Scaffold resistance.** `npm create vite` and `create-vue` both write a `.vscode/extensions.json`
  per project. Thirteen scaffolded projects produced twelve of them, every one recommending a test
  explorer for projects that have no tests.

### Trade-off

`customizations.vscode.settings` applies when the folder is opened in the container. Someone opening
the repository outside the devcontainer does not receive them. Both keys this workspace moved across
are explorer conveniences, so nothing builds, tests or lints differently, and `CONTRIBUTING.md` leads
with the Codespaces path. If that changes, `allowedDirectories` restores a root file without touching
the rule.

## Options

| Option               | Type       | Default                             | Description                                                                                           |
| -------------------- | ---------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `allowedDirectories` | `string[]` | `[]`                                | Workspace-relative directories permitted to hold a `.vscode` folder. Use `"."` for the workspace root |
| `configFile`         | `string`   | `".devcontainer/devcontainer.json"` | The file that owns VS Code configuration instead, named in the message                                |

## Examples

### ❌ Incorrect

```text
apps/demos/clock/.vscode/extensions.json
.vscode/settings.json
```

**Error**: `VS Code configuration belongs in .devcontainer/devcontainer.json under 'customizations.vscode', so the environment has one source of truth. Found 'apps/demos/clock/.vscode': merge what it holds into that file and delete it.`

### ✅ Correct

```text
.devcontainer/devcontainer.json    ← customizations.vscode.extensions + settings
```

## Configuration

Enabled from the root `eslint.config.cjs`:

```js
{
  files: ['**/package.json'],
  languageOptions: { parser: require('jsonc-eslint-parser') },
  rules: {
    'workspace/no-vscode-config': 'error',
  },
}
```

## Related Rules

- [project-lifecycle-policy](./project-lifecycle-policy.md): the lifecycle-conditional half of the
  same anti-sprawl policy
