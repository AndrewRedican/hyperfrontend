# Version Check Executor

Validates that version bumps have been correctly applied without making changes.

This executor is used by CI to verify that lefthook versioning ran successfully before push. It compares the expected version state (calculated via dry-run) against actual files on disk.

## Key Features

- **Read-only**: Does NOT modify any files or create commits
- **Dry-run comparison**: Calculates expected state by running version flow in dry-run mode
- **Changelog validation**: Uses `@hyperfrontend/versioning` changelog parsing to verify entry content
- **Clear remediation**: Provides actionable fix instructions on failure

## Usage

```bash
# Check a single library
npm run -s hf -- run lib-cryptography:version-check

# Verbose output for debugging
npm run -s hf -- run lib-cryptography:version-check --verbose
```

On a pull request, the `version-check` action runs it for every library that owns a changed file.

## Options

| Option                | Type    | Default    | Description                                 |
| --------------------- | ------- | ---------- | ------------------------------------------- |
| `verbose`             | boolean | false      | Enable detailed logging                     |
| `quiet`               | boolean | false      | Suppress non-error output                   |
| `skipIfVersionCommit` | boolean | true       | Skip if current commit is a version commit  |
| `repository`          | string  | 'inferred' | Repository config for changelog URLs        |
| `scopeFiltering`      | object  | -          | Scope filtering config for commit selection |

## Output

### Success

```
✅ lib-cryptography: version 2.1.0 matches expected
```

### Skipped

```
⏭️  lib-cryptography: No version bump required based on commit analysis
```

### Failure

```
❌ lib-cryptography: version mismatch

Expected: 2.1.0 (MINOR bump from 3 commit(s))
Actual:   2.0.0

Discrepancies:
  - package.json: version-mismatch
    Expected: 2.1.0
    Actual:   2.0.0

Remedy:
  Run: npm run -s hf -- run lib-cryptography:version
  Or push again to trigger lefthook versioning

To fix this issue:
  1. Pull latest changes: git pull origin <branch>
  2. Run versioning: npm run -s hf -- run lib-cryptography:version
  3. Commit the changes: git add . && git commit --amend --no-edit
  4. Push: git push --force-with-lease

Or push without --no-verify to let lefthook handle versioning automatically.
```

## When to Use

- **CI validation**: Verify versions were applied by lefthook before merge
- **Local verification**: Confirm lefthook versioning worked correctly
- **Debugging**: Understand why version state doesn't match expectations

## How It Works

1. **Calculate expected state**: Run version flow in dry-run mode
2. **Read actual state**: Parse package.json and CHANGELOG.md from disk
3. **Compare versions**: Check if `actual.version === expected.nextVersion`
4. **Compare changelog**: Verify entry exists and its content (version and sections) matches using `@hyperfrontend/versioning` comparison utilities. The entry's date and compare URL are stamped at generation time and are not compared, so a version commit that is still waiting to be published keeps validating as commits land on top of it
5. **Return result**: Pass if all match, fail with discrepancy details otherwise

## CI Integration

The version-check executor is called by the `version-check` job in `ci-pr.yml`:

```yaml
- name: Validate versions
  run: |
    for lib in $AFFECTED; do
      npm run -s hf -- run "$lib:version-check" --verbose=true
    done
```

If validation fails, CI comments on the PR with:

- Which libraries have version issues
- Step-by-step remediation instructions
- Detailed validation output in a collapsible section

## Relationship to Version Executor

The version-check executor shares validation logic with the version executor:

```
tools/package/src/executors/
├── version/
│   └── lib/
│       └── validate-version-state.ts  ← Shared validation logic
└── version-check/
    └── executor.ts                    ← Imports and uses shared logic
```

This ensures validation in CI matches what the version executor would produce.

## See Also

- [version executor](../version/README.md): The executor that creates version bumps
- [version executor ARCHITECTURE.md](../version/ARCHITECTURE.md): Architecture including CI integration
- [lefthook.yml](../../../../../lefthook.yml): Git hooks that run versioning locally
- [Versioning roadmap](../../../../../roadmap/versioning/README.md): Future considerations for the versioning library
