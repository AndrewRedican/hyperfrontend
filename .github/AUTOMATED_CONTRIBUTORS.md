# Automated Contributors Management

This project uses automated workflows to recognize contributors.

## 🤖 Smart Contribution Type Suggestions

When a maintainer **approves a pull request**, our automated system analyzes the changed files and suggests appropriate contribution types. This makes it easy for maintainers to recognize contributors accurately.

### How It Works

1. **Maintainer approves** a PR (review approval)
2. **GitHub Actions analyzes** the changed files using intelligent heuristics
3. **Bot posts a comment** with suggested contribution types
4. **Maintainer can accept** the suggestion or modify it as needed

### Detection Heuristics

The system automatically detects contribution types based on file patterns:

| Contribution Type | Detected From             | Example Files                                         |
| ----------------- | ------------------------- | ----------------------------------------------------- |
| **doc**           | Documentation files       | `docs/`, `*.md`, `README`, `CONTRIBUTING`             |
| **code**          | Source code files         | `src/**/*.ts`, `packages/**/*.js`, `apps/**/*.tsx`    |
| **test**          | Test files                | `*.test.ts`, `*.spec.js`, `__tests__/`, `*.e2e.*`     |
| **infra**         | CI/CD and infrastructure  | `.github/workflows/`, `.devcontainer/`, `Dockerfile`  |
| **tool**          | Configuration and tooling | `eslint.config.js`, `tsconfig.json`, `scripts/`       |
| **design**        | Design and styling        | `*.css`, `*.scss`, `assets/`, `*.svg`, `packages/ui/` |
| **example**       | Examples and demos        | `examples/`, `demos/`, sample files                   |
| **plugin**        | Plugin development        | `plugins/`, `packages/nx-plugin/`                     |

The bot provides a **non-intrusive advisory comment** with:

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

| Type        | Description         | Comment Usage     |
| ----------- | ------------------- | ----------------- |
| code        | Code contributions  | `for code`        |
| doc         | Documentation       | `for doc`         |
| design      | Design              | `for design`      |
| bug         | Bug reports         | `for bug`         |
| ideas       | Ideas & Planning    | `for ideas`       |
| infra       | Infrastructure      | `for infra`       |
| maintenance | Maintenance         | `for maintenance` |
| review      | Code reviews        | `for review`      |
| test        | Tests               | `for test`        |
| tool        | Tools               | `for tool`        |
| translation | Translation         | `for translation` |
| tutorial    | Tutorials           | `for tutorial`    |
| question    | Answering Questions | `for question`    |
| talk        | Talks               | `for talk`        |
| blog        | Blog posts          | `for blog`        |
| financial   | Financial support   | `for financial`   |
| video       | Videos              | `for video`       |
| example     | Examples            | `for example`     |
| plugin      | Plugins             | `for plugin`      |
| platform    | Packaging/porting   | `for platform`    |
| mentoring   | Mentoring           | `for mentoring`   |

### Examples

```
@all-contributors please add @johndoe for code and test
@all-contributors please add @janedoe for doc
@all-contributors please add @sponsor for financial
```

## How It Works

### Smart Suggestions on PR Approval

1. Maintainer approves a PR with review
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
4. Bot creates a PR with the changes
5. Maintainer merges the PR

## Permissions

The workflow has these permissions:

- `contents: write` - To commit changes to the repository
- `pull-requests: write` - To create PRs for manual additions
- `issues: write` - To respond to comments

## Updating Contribution Types

If a contributor should have additional contribution types:

1. Comment on any issue/PR:

   ```
   @all-contributors please add @username for code, doc, and review
   ```

2. Or manually edit `.all-contributorsrc` and run:
   ```bash
   npm run contributors:generate
   ```

## Troubleshooting

### Workflow didn't trigger on PR merge

- Check that the PR was from a fork (not a branch in the main repo)
- Check the Actions tab for any errors
- Verify GitHub Actions are enabled

### Bot didn't respond to comment

- Ensure you used the exact format: `@all-contributors please add @username for type`
- Check that you have the proper permissions
- The bot may take a minute to respond

### Manual fallback

If automation fails, you can always add contributors manually:

```bash
npm run contributors:add -- username code,doc
npm run contributors:generate
git add .all-contributorsrc README.md
git commit -m "docs: add @username as a contributor"
```

## Configuration

The automation is configured in:

- `.github/workflows/contributor-suggest.yml` - Smart contribution type suggestion workflow
- `.all-contributorsrc` - Contributors database

## Benefits of Smart Suggestions

✅ **Accurate Recognition**: File-based heuristics ensure contributors get credit for what they actually changed
✅ **Maintainer Control**: Suggestions are advisory only; maintainer makes the final decision
✅ **Non-Intrusive**: Only triggers on PR approval, not on every PR
✅ **Time-Saving**: No need to manually analyze PR changes
✅ **Transparent**: Shows which files influenced the suggestion
✅ **Flexible**: Easy to override or modify suggested types

---

**Note**: The suggestion system only triggers when repository owners or designated maintainers approve PRs. Regular contributors can still be added manually using the `@all-contributors` command.
