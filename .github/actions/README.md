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

1. Sets up Node.js version 24.18.0 (matches package.json engines)
2. Caches npm dependencies using `package-lock.json` hash
3. Installs dependencies with `npm ci`

---

### nx-affected

**Purpose**: Calculates affected projects using Nx based on git changes between two references.

**Location**: `.github/actions/nx-affected/action.yml`

**Inputs**:

- `base-ref` (required): Base git reference for comparison (e.g., `origin/main`)
- `head-ref` (optional, default: `'HEAD'`): Head git reference for comparison
- `targets` (optional, default: `''`): Comma-separated list of targets to check

**Outputs**:

- `affected-projects`: Comma-separated list of affected project names (e.g., `project1,project2`)
- `has-affected`: Boolean string (`'true'` or `'false'`) indicating if there are any affected projects
- `projects-json`: JSON array of affected project names (e.g., `["project1","project2"]`)

**Usage**:

```yaml
- name: Calculate affected projects
  id: nx-affected
  uses: ./.github/actions/nx-affected
  with:
    base-ref: origin/${{ github.base_ref }}
    head-ref: HEAD

- name: Use affected projects
  run: echo "Affected: ${{ steps.nx-affected.outputs.affected-projects }}"

- name: Skip if no affected projects
  if: steps.nx-affected.outputs.has-affected != 'true'
  run: echo "No affected projects"
```

**What it does**:

1. Runs `npx nx show projects --affected` to calculate affected projects
2. Handles cases where no projects are affected
3. Converts output to multiple formats (CSV, JSON, boolean)
4. Sets GitHub Actions outputs for downstream jobs

**Important Notes**:

- Requires `fetch-depth: 0` in the checkout step for accurate git history
- Returns empty values and `has-affected=false` when no projects are affected
- Useful for optimizing CI by running checks only on changed code

---

### run-checks

**Purpose**: Runs specific checks (format, lint, test, build, e2e) for all or affected projects using Nx.

**Location**: `.github/actions/run-checks/action.yml`

**Inputs**:

- `check-type` (required): Type of check to run (`format`, `lint`, `test`, `build`, or `e2e`)
- `affected-only` (optional, default: `'false'`): Whether to run checks only on affected projects
- `affected-projects` (optional, default: `''`): Comma-separated list of affected project names (required if `affected-only` is `true`)

**Usage**:

```yaml
# Run format check on all projects
- name: Run format check
  uses: ./.github/actions/run-checks
  with:
    check-type: format
    affected-only: 'false'

# Run lint only on affected projects
- name: Run lint on affected
  uses: ./.github/actions/run-checks
  with:
    check-type: lint
    affected-only: 'true'
    affected-projects: ${{ needs.setup.outputs.affected-projects }}
```

**Check Types**:

- `format`: Runs `format:check` target (code formatting validation)
- `lint`: Runs `lint` target (linting)
- `test`: Runs `test` target (unit tests)
- `build`: Runs `build` target (compilation/bundling)
- `e2e`: Runs `e2e` target (end-to-end tests)

**What it does**:

1. Determines the Nx target based on check type
2. If `affected-only` is true and projects are specified, runs on those projects
3. If `affected-only` is true but no projects, skips execution
4. If `affected-only` is false, runs on all projects
5. Uses `CI=1` for deterministic behavior and `--parallel=1` for sequential execution

**Important Notes**:

- Automatically skips when `affected-only=true` but no affected projects
- Sequential execution (`--parallel=1`) prevents resource exhaustion issues
- `CI=1` ensures deterministic build behavior
- Exit code is preserved (fails workflow if check fails)

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
2. **Validates versions**: Runs `nx version-check` for each affected library with a version target
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
- Requires `pull-requests: write` permission for commenting
- Uses `gh` CLI for API calls (included in GitHub Actions runners)
- Skips gracefully when no libraries with version targets are affected

---

## Design Principles

### Composability

Actions are designed to be used together in workflows:

```yaml
- uses: ./.github/actions/setup-monorepo
- uses: ./.github/actions/nx-affected
  id: affected
- uses: ./.github/actions/run-checks
  with:
    affected-only: 'true'
    affected-projects: ${{ steps.affected.outputs.affected-projects }}
```

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
act pull_request -j setup -W .github/workflows/ci-pr.yml

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
