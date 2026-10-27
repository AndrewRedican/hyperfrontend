# Custom GitHub Actions

This directory contains reusable composite actions for the hyperfrontend monorepo workflows.

## Available Actions

### setup-monorepo

**Purpose**: Sets up the Node.js environment, caches npm dependencies, and installs packages for the monorepo.

**Location**: `.github/actions/setup-monorepo/action.yml`

**Outputs**:

- `cache-hit`: Boolean indicating whether npm cache was hit

**Usage**:

```yaml
- name: Setup monorepo
  uses: ./.github/actions/setup-monorepo
```

**What it does**:

1. Sets `NX_NO_CLOUD=true` when `nx.json` sets `neverConnectToCloud`, so no Nx invocation reaches Nx Cloud
2. Sets up the Node.js version `.nvmrc` names (the same one package.json engines requires)
3. Caches npm dependencies using `package-lock.json` hash; no task output is cached
4. Installs dependencies with `npm ci`

---

### version-check

**Purpose**: Validates version bumps for affected libraries and manages PR comments with idempotency.

**Location**: `.github/actions/version-check/action.yml`

**Inputs**:

- `base-ref` (required): Base git reference for comparison (e.g., `origin/main`)
- `head-ref` (optional, default: `'HEAD'`): Head git reference for comparison
- `github-token` (required): GitHub token for PR comments
- `pr-number` (required): Pull request number for commenting
- `comment-on-success` (optional, default: `'false'`): Whether to post a success comment with version bump details

**Outputs**:

- `status`: Validation status (`valid`, `invalid`, or `skipped`)
- `valid-libs`: Comma-separated list of libraries that passed validation
- `invalid-libs`: Comma-separated list of libraries that failed validation
- `skipped-libs`: Comma-separated list of libraries that were skipped

**Usage**:

```yaml
- name: Validate versions
  id: version-check
  uses: ./.github/actions/version-check
  with:
    base-ref: origin/${{ github.base_ref }}
    head-ref: HEAD
    github-token: ${{ secrets.GITHUB_TOKEN }}
    pr-number: ${{ github.event.pull_request.number }}
    comment-on-success: 'false' # Set to 'true' for success comments
```

**What it does**:

1. **Removes stale comments**: Deletes any existing version-check comments from previous runs (idempotency)
2. **Validates versions**: Lists the libraries owning a changed file, or every library when a global configuration file (`nx.json`, `package.json`, `package-lock.json`, `tsconfig.base.json`) changes (`pipeline affected --target version-check --projects`), and runs `hf.ts run <library>:version-check --verbose=true` for each. The job only checks versions; the pre-push hook bumps them
3. **Posts failure comment**: If validation fails, posts a comment with:
   - List of libraries with issues
   - Step-by-step fix instructions
   - Detailed error messages in a collapsible section
4. **Posts success comment** (optional): If `comment-on-success` is true and validation passes, posts success details

**Comment Idempotency**:

- Comments are identified by a hidden marker: `<!-- hyperfrontend-version-check -->`
- Each workflow run removes existing comments before posting new ones
- This prevents comment accumulation across multiple pushes
- When validation passes (and `comment-on-success` is false), all previous failure comments are removed

**Important Notes**:

- Requires `fetch-depth: 0` in checkout for accurate git history
- Builds the graph state under `.hf/graph` cold
- Requires `pull-requests: write` permission for commenting
- Uses `gh` CLI for API calls (included in GitHub Actions runners)
- Skips gracefully when the change selects no library

---

## Design Principles

### Composability

Actions are designed to be used together in workflows:

```yaml
- uses: ./.github/actions/setup-monorepo
- uses: ./.github/actions/version-check
  with:
    base-ref: origin/${{ github.base_ref }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    pr-number: ${{ github.event.pull_request.number }}
```

The selection of work is not an action: the `plan` job runs `tools/workspace/bin/pipeline.ts plan`, and the `environment` jobs run `pipeline.ts run`. The workflow files hold only what GitHub itself must read (triggers, permissions, runners, caches, artifacts, secrets, timeouts); selection, ordering, parallelism, failure propagation and publish gating live in `tools/workspace/src/pipeline`.

### Reusability

Actions can be used across multiple workflows (PR, main, deployment) without duplication.

### Simplicity

Each action has a single, clear responsibility and minimal inputs.

### Security

Actions use pinned versions of third-party actions with commit SHAs.

## Testing Custom Actions

Test actions locally using [act](https://github.com/nektos/act):

```bash
# Test in the context of a workflow
act pull_request -j plan -W .github/workflows/ci-pr.yml

# Test with specific inputs
act pull_request -W .github/workflows/ci-pr.yml
```

## Maintenance

### Updating Actions

When updating an action:

1. Make changes to the `action.yml` file
2. Test locally with `act`
3. Update this documentation
4. Update any workflows that use the action
5. Test in a PR before merging

### Adding New Actions

When adding a new action:

1. Create directory: `.github/actions/<action-name>/`
2. Create `action.yml` with clear inputs/outputs
3. Document in this README
4. Add usage examples
5. Test with `act`

### Common Issues

**Action not found**:

- Ensure the action is checked out (repository must be checked out first)
- Verify the path is correct (e.g., `./.github/actions/setup-monorepo`)

**Inputs not working**:

- Check input types (all inputs are strings in GitHub Actions)
- Use quotes for boolean values: `'true'` not `true`

**Outputs not available**:

- Ensure the action has an `id` in the workflow step
- Reference outputs with `${{ steps.<id>.outputs.<output-name> }}`

## Examples

### Complete PR Validation Pattern

```yaml
jobs:
  setup:
    runs-on: ubuntu-latest
    outputs:
      affected-projects: ${{ steps.affected.outputs.affected-projects }}
      has-affected: ${{ steps.affected.outputs.has-affected }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: ./.github/actions/setup-monorepo
      - id: affected
        uses: ./.github/actions/nx-affected
        with:
          base-ref: origin/main

  lint:
    needs: setup
    if: needs.setup.outputs.has-affected == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-monorepo
      - uses: ./.github/actions/run-checks
        with:
          check-type: lint
          affected-only: 'true'
          affected-projects: ${{ needs.setup.outputs.affected-projects }}
```

### Complete Main Branch Pattern

```yaml
jobs:
  setup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-monorepo

  test:
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-monorepo
      - uses: ./.github/actions/run-checks
        with:
          check-type: test
          affected-only: 'false'
```

## Future Enhancements

Potential actions to add:

- **publish-package**: Publishes npm packages with versioning
- **deploy-demo**: Deploys demo applications
- **create-release**: Creates GitHub releases with changelogs
- **notify-slack**: Sends notifications to Slack
- **update-coverage**: Updates coverage badges/reports
