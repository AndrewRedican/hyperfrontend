# Automated Contributors Management

Contributors are recognized through the [All Contributors bot](https://allcontributors.org/docs/en/bot/overview), installed on this repository, helped by a workflow that suggests what to credit. Maintainers add every contributor themselves, so nobody needs to ask for credit; what this automation saves is the work of deciding which contribution types to record.

## 🤖 Smart Contribution Type Suggestions

When a maintainer **approves a pull request**, our automated system analyzes the changed files and suggests appropriate contribution types. This makes it easy for maintainers to recognize contributors accurately.

### How It Works

1. **Maintainer approves** a PR (review approval)
2. **GitHub Actions analyzes** the changed files using intelligent heuristics
3. **Bot posts a comment** with suggested contribution types
4. **Maintainer can accept** the suggestion or modify it as needed

### Detection Heuristics

The system automatically detects contribution types based on file patterns:

| Contribution Type | Detected From             | Example Files                                          |
| ----------------- | ------------------------- | ------------------------------------------------------ |
| **doc**           | Documentation files       | `docs/`, `*.md`, `README`, `CONTRIBUTING`              |
| **code**          | Source code files         | `libs/**/*.ts`, `apps/**/*.tsx`, `plugins/**/*.js`     |
| **test**          | Test files                | `*.test.ts`, `*.spec.js`, `__tests__/`, `*.e2e.*`      |
| **infra**         | CI/CD and infrastructure  | `.github/workflows/`, `.devcontainer/`, `Dockerfile`   |
| **tool**          | Configuration and tooling | `tools/`, `lint.config.ts`, `hf.json`, `tsconfig.json` |
| **design**        | Design and styling        | `*.css`, `*.scss`, `assets/`, `*.svg`, `packages/ui/`  |
| **example**       | Examples and demos        | `apps/demos/`, `examples/`, sample files               |
| **plugin**        | Plugin development        | `plugins/`                                             |

Each file counts toward one type: the first match among doc, test, infra, tool, design, example and plugin, and code only when none of those matched. A spec under `libs/` therefore counts as a test, and a demo's source as an example. The workflow posts a **non-intrusive advisory comment** with:

- Suggested contribution types based on file analysis
- Sample of detected files
- Easy copy-paste command to add the contributor
- Option to modify types as needed

### Example Bot Comment

When a PR is approved, maintainers receive a comment like this:

```
🏆 Contributor Recognition Suggestion

Based on the files changed in this PR, I suggest recognizing @contributor for:

Suggested types: code (Code contributions), test (Test additions or improvements)

Quick Actions:
@all-contributors please add @contributor for code, test
```

## Manual Addition via Comments

You can also add contributors manually by commenting on any issue or PR:

### Add a Code Contributor

```
@all-contributors please add @username for code
```

### Add Multiple Contribution Types

```
@all-contributors please add @username for code, doc, and design
```

### Available Contribution Types

Any type the All Contributors specification defines works, for example `code`, `doc`, `bug`, `ideas`, `research`, `review`, `test` or `tool`. The [contributors guide](CONTRIBUTORS_GUIDE.md#recognition-types) lists them all with their emoji.

### Examples

```
@all-contributors please add @johndoe for code and test
@all-contributors please add @janedoe for doc
@all-contributors please add @sponsor for financial
```

## How It Works

### Smart Suggestions on PR Approval

1. Maintainer approves a PR from someone else (GitHub does not let authors approve their own PRs)
2. GitHub Actions workflow (`contributor-suggest.yml`) triggers
3. System analyzes changed files using pattern matching
4. Bot posts a comment with suggested contribution types
5. Maintainer uses the suggestion or modifies as needed
6. Maintainer comments with `@all-contributors` command
7. All Contributors bot updates the README

### On Comment (Manual)

1. Maintainer or contributor comments with `@all-contributors` command
2. All Contributors bot processes the comment
3. Contributor is added with specified types
4. Bot creates a PR that updates `.all-contributorsrc` and `README.md`
5. Maintainer merges the PR

The bot's commit is `docs: add @username as a contributor`. It carries no scope, so it never triggers a version bump, and the commit-msg check accepts it.

## Permissions

The suggestion workflow has these permissions:

- `contents: read` - To check out the repository
- `pull-requests: write` - To list the PR's files and post the suggestion comment

The All Contributors bot works under its own GitHub App installation, not under this workflow.

## Updating Contribution Types

If a contributor should have additional contribution types:

1. Comment on any issue/PR:

   ```
   @all-contributors please add @username for code, doc, and review
   ```

2. Or manually edit `.all-contributorsrc` and run:
   ```bash
   npx --yes all-contributors-cli@6.26.1 generate
   npx hf format --write --files=README.md
   ```

## Troubleshooting

### No suggestion appeared on a PR

- The workflow runs only when the repository owner approves a PR in a review, so it never runs on the owner's own PRs
- Check the Actions tab for any errors

### Bot didn't respond to comment

- Ensure you used the exact format: `@all-contributors please add @username for type`
- Check that you have the proper permissions
- The bot may take a minute to respond
- If it answers "We had trouble processing your request", check that `.all-contributorsrc` still parses and that `badgeTemplate` holds no template variables: a template the bot cannot render fails every request

### Manual fallback

If automation fails, you can always add contributors manually:

```bash
npx --yes all-contributors-cli@6.26.1 add username code,doc
npx hf format --write --files=README.md
git add .all-contributorsrc README.md
git commit -m "docs(hyperfrontend): add @username as a contributor"
```

## Configuration

The automation is configured in:

- `.github/workflows/contributor-suggest.yml` - Smart contribution type suggestion workflow
- `.all-contributorsrc` - Contributors database, read by both the bot and the CLI

## Benefits of Smart Suggestions

✅ **Accurate Recognition**: File-based heuristics ensure contributors get credit for what they actually changed
✅ **Maintainer Control**: Suggestions are advisory only; maintainer makes the final decision
✅ **Non-Intrusive**: Only triggers on PR approval, not on every PR
✅ **Time-Saving**: No need to manually analyze PR changes
✅ **Transparent**: Shows which files influenced the suggestion
✅ **Flexible**: Easy to override or modify suggested types

---

**Note**: The suggestion system only triggers when repository owners or designated maintainers approve PRs. Regular contributors can still be added manually using the `@all-contributors` command.
