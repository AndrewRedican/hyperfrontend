# Version Executor

Idempotent version executor using `@hyperfrontend/versioning` - a zero-dependency conventional commits versioning library.

## Key Features

- **npm as source of truth** — Uses npm registry to determine current version, not git tags
- **Idempotency** — Safe to run multiple times; skips if version already published
- **Recursion prevention** — Skips if HEAD is a version commit for this project
- **Documentation support** — `docs` commits trigger MINOR version bumps
- **Dependent updates** — Automatically updates version references in dependent packages
- **Zero external dependencies** — Uses `@hyperfrontend/versioning` which has no transitive dependencies

## Usage

```bash
# Version a single library
npx nx version lib-cryptography

# Dry run to see what would happen
npx nx version lib-cryptography --dryRun

# Force a specific bump type
npx nx version lib-cryptography --releaseAs=minor

# Output modified files (for CI)
npx nx version lib-cryptography --collectFiles
```

## Options

| Option                | Type    | Default          | Description                                          |
| --------------------- | ------- | ---------------- | ---------------------------------------------------- |
| `dryRun`              | boolean | false            | Preview changes without committing                   |
| `releaseAs`           | string  | -                | Force bump type: `major`, `minor`, or `patch`        |
| `tagPrefix`           | string  | `{projectName}@` | Version tag prefix                                   |
| `trackDeps`           | boolean | false            | Include dependencies in version calculation          |
| `skipCommit`          | boolean | false            | Skip creating a version commit                       |
| `skipTag`             | boolean | true             | Skip creating a git tag (tags created after publish) |
| `updateDependents`    | boolean | true             | Update version references in dependent packages      |
| `skipIfVersionCommit` | boolean | true             | Skip if current commit is a version commit           |
| `skipIfUnstableGit`   | boolean | true             | Skip if git is in rebase/merge state                 |
| `collectFiles`        | boolean | false            | Output modified files list (implies skipCommit)      |
| `verbose`             | boolean | false            | Enable detailed logging                              |
| `quiet`               | boolean | false            | Suppress non-error output                            |

## Commit Types and Version Impact

| Commit Type       | Version Bump | Changelog Section |
| ----------------- | ------------ | ----------------- |
| `feat`            | MINOR        | Features          |
| `fix`             | PATCH        | Bug Fixes         |
| `perf`            | PATCH        | Performance       |
| `revert`          | PATCH        | Reverts           |
| `docs`            | MINOR        | Documentation     |
| `BREAKING CHANGE` | MAJOR        | Breaking Changes  |

> **Note:** `docs` commits trigger MINOR bumps in this project, reflecting that documentation updates are meaningful user-facing changes.

Commits with types `chore`, `ci`, `build`, `test`, `style`, `refactor` do not trigger version bumps but may appear in the changelog under "Other Changes" if they have notable content.

## How It Works

### Version Flow

1. **Fetch Registry Version** — Query npm for the latest published version
2. **Analyze Commits** — Parse commits since last release using conventional commit format
3. **Calculate Version Bump** — Determine major/minor/patch based on commit types
4. **Check Idempotency** — Skip if calculated version is already on npm
5. **Generate Changelog** — Build changelog entry from commits
6. **Update Package Version** — Update package.json
7. **Write Changelog** — Update CHANGELOG.md
8. **Create Version Commit** — Stage and commit changes (unless `skipCommit`)

### Dependent Updates

When a package is versioned, the executor automatically:

1. Finds all packages that depend on the versioned package
2. Updates their `package.json` dependency versions
3. Updates E2E test packages that reference the tarball

This is controlled by the `updateDependents` option (default: true).

### CI Integration

The executor integrates with CI workflows in two modes:

**PR Workflow (version-validation):**

```bash
npx nx version lib-xxx --collectFiles
# Outputs: MODIFIED:libs/xxx/package.json
#          MODIFIED:libs/xxx/CHANGELOG.md
```

**Main Workflow:**

1. `publish` job publishes to npm
2. `push-tags` job creates git tags for published versions
3. `create-github-release` job creates GitHub releases

Tags are created **after** publish, not during versioning. This is why `skipTag` defaults to `true`.

## Troubleshooting

### Version not bumping?

- Ensure commits follow conventional format: `type(scope): message`
- Check that commit types trigger bumps (see table above)
- Run with `--verbose` to see commit analysis

### Already versioned?

The executor skips if:

- Current HEAD is a version commit for this project
- The calculated next version is already on npm

This is intentional idempotency. Run with `--verbose` to see skip reasons.

### Git state issues?

The executor skips if git is in rebase/merge state. Complete or abort the operation first.
