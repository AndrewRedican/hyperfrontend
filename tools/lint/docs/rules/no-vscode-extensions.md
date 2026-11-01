# no-vscode-extensions

Install no VS Code extension in the devcontainer but the ones the configuration allows.

## Rule Details

`.devcontainer/devcontainer.json` is the only place this workspace declares VS Code extensions
([no-vscode-config](./no-vscode-config.md) keeps `.vscode` directories out). This rule reads its
`customizations.vscode.extensions` list and reports every identifier the `allow` option does not
name. Identifiers compare without regard to case, as VS Code compares them; an entry that is no
string is left alone.

### Why?

- **No tooling the workspace does not use.** Every extension the container installs runs in
  everyone's editor. Formatting and linting run through `npm run hf --` and the git hooks, so an
  editor extension doing the same work is a second, drifting copy of it.
- **A deliberate exception list.** Adding an extension means adding it to `allow` in the root
  `lint.config.ts`, so each one is a reviewed decision rather than a line slipped into the
  container.

## Options

| Option  | Type       | Default | Description                                         |
| ------- | ---------- | ------- | --------------------------------------------------- |
| `allow` | `string[]` | `[]`    | The extension identifiers the devcontainer may list |

## Examples

### ❌ Incorrect

```json
{ "customizations": { "vscode": { "extensions": ["anthropic.claude-code", "esbenp.prettier-vscode"] } } }
```

**Error**: `The devcontainer installs the VS Code extension 'esbenp.prettier-vscode', which the workspace does not allow. Remove it, or add it to the rule's 'allow' option if the workspace relies on it.`

### ✅ Correct

```json
{ "customizations": { "vscode": { "extensions": ["anthropic.claude-code"] } } }
```

## Configuration

Enabled from the root `lint.config.ts`:

```js
{
  files: ['.devcontainer/**/devcontainer.json'],
  rules: {
    'workspace/no-vscode-extensions': ['error', { allow: ['anthropic.claude-code', 'github.vscode-github-actions'] }],
  },
}
```

## Related Rules

- [no-vscode-config](./no-vscode-config.md): keeps the devcontainer the one home of VS Code
  configuration
