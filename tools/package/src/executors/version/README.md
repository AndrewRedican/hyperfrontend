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
npx hf run lib-cryptography:version

# Dry run to see what would happen
npx hf run lib-cryptography:version --dryRun

# Force a specific bump type
npx hf run lib-cryptography:version --releaseAs=minor
```

For batch versioning of all affected libraries, use the `version:all` target:

```bash
# Preview batch versioning
npx hf run hyperfrontend:version:all --dryRun

# Run batch versioning (typically done by lefthook)
npx hf run hyperfrontend:version:all

# Force a patch on named libraries, for a change to the package artifact
# (a readme, say) that no commit type would release on its own
npx hf run hyperfrontend:version:all \
  --releaseAs=patch --libraries=lib-logging,lib-nexus
```

## Options

| Option                | Type    | Default          | Description                                              |
| --------------------- | ------- | ---------------- | -------------------------------------------------------- |
| `dryRun`              | boolean | false            | Preview changes without committing                       |
| `releaseAs`           | string  | -                | Force bump type: `major`, `minor`, or `patch`            |
| `tagPrefix`           | string  | `{projectName}@` | Version tag prefix                                       |
| `trackDeps`           | boolean | false            | Include dependencies in version calculation              |
| `skipCommit`          | boolean | false            | Skip creating a version commit                           |
| `skipTag`             | boolean | true             | Skip creating a git tag (tags created after publish)     |
| `updateDependents`    | boolean | true             | Update version references in dependent packages          |
| `skipIfVersionCommit` | boolean | true             | Skip if current commit is a version commit               |
| `skipIfUnstableGit`   | boolean | true             | Skip if git is in rebase/merge state                     |
| `verbose`             | boolean | false            | Enable detailed logging                                  |
| `quiet`               | boolean | false            | Suppress non-error output                                |
| `showDiff`            | boolean | false            | Show unified diff of changes before committing           |
| `diffFormat`          | string  | `unified`        | Diff format: `unified` (full patch) or `summary` (stats) |
| `rollbackOnFailure`   | boolean | true             | Discard all VFS changes if any step fails                |
| `backupChangelog`     | boolean | false            | Create backup of changelog before modification           |

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

### Changes That Reach a Library Indirectly

A library is also released when the workspace graph rebuilds it for a change it did not make itself:

- **Code it ships.** A releasable commit (`feat`, `fix`, `perf`, `revert`) in a package the library's build reaches through imports, directly or through other packages. The built library carries a copy of that code, so the copy is out of date until the library is released.
- **The toolchain.** A releasable commit in a project the `build` target declares as an input in `hf.json` (the builder and the package executors). Every library is built by them.

Such a change raises the library by a **patch**, whatever the commit's own type, and is listed in its changelog as an indirect change. The library's own commits keep the level from the table above.

A change that only touches a global configuration file (`hf.json`, the root `package.json`, `package-lock.json`, `tsconfig.base.json`) or another file the workspace root owns rebuilds libraries and releases none. So does a change in something only the build executor imports: the toolchain is what the target declares, not everything it loads.

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

#### Local Versioning (Primary)

Version bumps are applied **locally** via lefthook pre-push hooks. When you `git push`:

1. lefthook runs the pipeline (typecheck, lint, test, build and e2e of what the push reaches), then the root project's `version:all` target, which detects affected libraries
2. For each affected library, package.json and CHANGELOG.md are updated
3. A single batch commit is created: `chore: update versions for lib-a, lib-b`
4. Push proceeds with the version commit included

See [lefthook.yml](../../../../lefthook.yml) for the hook configuration.

#### CI Validation (version-check)

CI validates that version bumps were correctly applied using the **version-check** executor:

```bash
npx hf run lib-xxx:version-check
# Outputs: ✅ lib-xxx: version 2.1.0 matches expected
# Or:      ❌ lib-xxx: version mismatch (with remediation steps)
```

This is read-only validation — CI does NOT create commits. If you bypass lefthook with `--no-verify`, CI will fail with instructions to fix.

See [version-check executor](../version-check/README.md) for details.

#### Main Workflow (publish)

After PR merge to main:

1. `publish` job publishes to npm
2. `push-tags` job creates git tags for published versions
3. `create-github-release` job creates GitHub releases

Tags are created **after** publish, not during versioning. This is why `skipTag` defaults to `true`.

## Related Executors

- **[version-check](../version-check/README.md)** — Validates version state without making changes (used by CI)

## Troubleshooting

### Version not bumping?

- Ensure commits follow conventional format: `type(scope): message`
- Check that commit types trigger bumps (see table above)
- Run with `--verbose` to see commit analysis
- The classification breakdown in the verbose output counts `indirect-dependency` commits: the ones that reach the library through code it ships or through the toolchain

### Already versioned?

The executor skips if:

- Current HEAD is a version commit for this project
- The calculated next version is already on npm

This is intentional idempotency. Run with `--verbose` to see skip reasons.

### Git state issues?

The executor skips if git is in rebase/merge state. Complete or abort the operation first.
