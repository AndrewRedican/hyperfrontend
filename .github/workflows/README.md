# GitHub Actions Workflows

This directory contains the CI/CD workflows for the hyperfrontend monorepo.

## Active Workflows

### CI - Pull Request ([ci-pr.yml](./ci-pr.yml))

**Trigger**: Pull requests to `main` branch
**Purpose**: Fast validation of changes using Nx affected calculations

**Features**:

- Calculates affected projects based on git changes
- Runs checks only on affected projects (format, lint, build, test)
- Optimized for speed (<10 minutes typical)
- Cancels in-progress runs when new commits are pushed
- Read-only permissions by default
- Uploads build artifacts for reuse

**Jobs**:

- `setup`: Calculates affected projects using Nx
- `format`: Format checking (affected only)
- `lint`: Linting (affected only)
- `typecheck`: Type checking (affected only)
- `build`: Build with artifact upload (affected only)
- `test`: Testing with coverage upload (affected only)
- `e2e`: E2E tests (affected only)
- `ci-status`: Aggregates results and provides final status

### CI - Main Branch ([ci-main.yml](./ci-main.yml))

**Trigger**: Pushes to `main` branch
**Purpose**: Comprehensive validation of all projects

**Features**:

- Runs checks on ALL projects (not just affected)
- Includes coverage threshold checking
- Does not cancel in-progress runs (safer for main branch)
- Longer retention for coverage reports (30 days)
- Uploads build artifacts for publishing
- Automated npm publishing and GitHub releases

**Jobs**:

- `setup`: Installs dependencies and prepares the workspace
- `format`: Format checking (all projects)
- `lint`: Linting (all projects)
- `typecheck`: Type checking (all projects)
- `build`: Build with artifact upload (all projects)
- `test`: Testing with coverage thresholds (all projects)
- `e2e`: E2E tests (all projects)
- `ci-status`: Aggregates results and provides final status
- `push-tags`: Creates and pushes version tags
- `publish`: Publishes affected libraries to npm
- `create-github-release`: Creates GitHub releases with changelog

### CI - Libraries ([ci-libraries.yml](./ci-libraries.yml))

**Trigger**: Pushes to `main` branch affecting `libs/**`
**Purpose**: Targeted CI for individual library changes

**Features**:

- Uses `dorny/paths-filter` to detect which libraries changed
- Runs CI only for affected libraries using a dynamic matrix
- Efficient: only builds/tests what changed
- Same permissions and security model as other workflows

**Excluded Libraries** (explicitly excluded from CI):

- `lib-web-worker`: Experimental/unstable

**Jobs**:

- `detect-changes`: Determines which libraries were modified
- `ci`: Matrix job that runs `_lib-ci.yml` template for each changed library

### CI - Plugins ([ci-plugins.yml](./ci-plugins.yml))

**Trigger**: Pushes to `main` branch affecting `plugins/**`
**Purpose**: Targeted CI for individual plugin changes

**Features**:

- Uses `dorny/paths-filter` to detect which plugins changed
- Runs CI only for affected plugins using a dynamic matrix
- Efficient: only builds/tests what changed
- Same mechanism as library CI for consistency

**Excluded Plugins** (explicitly excluded from CI):

- `plugin-features`: Experimental/unstable (v0.0.0)
- `plugin-features-e2e`: E2E test project for features plugin

**Jobs**:

- `detect-changes`: Determines which plugins were modified
- `ci`: Matrix job that runs `_lib-ci.yml` template for each changed plugin

### Library CI Template ([\_lib-ci.yml](./_lib-ci.yml))

**Trigger**: Called by other workflows via `workflow_call`
**Purpose**: Reusable template for library CI

**Inputs**:

- `project-name`: Nx project name (e.g., lib-nexus)
- `coverage-path`: Path to lcov.info file
- `coverage-flag`: Codecov flag name

**Jobs**:

- `build`: Typecheck, build, test with coverage upload to Codecov

### Security Scanning ([security-scan.yml](./security-scan.yml))

**Trigger**:

- Push to `main`
- Pull requests to `main`
- Weekly schedule (Mondays at 00:00 UTC)
- Manual dispatch

**Features**:

- CodeQL static analysis for JavaScript
- npm dependency vulnerability scanning
- Fails on high or critical vulnerabilities

**Jobs**:

- `codeql-analysis`: Static code analysis
- `dependency-audit`: Checks for vulnerable dependencies

## Custom Actions

All custom actions are located in [`.github/actions/`](../actions/):

### setup-monorepo

Sets up the Node.js environment, caches npm dependencies and Nx cache, and installs packages.

**Outputs**:

- `cache-hit`: Whether npm cache was hit
- `nx-cache-hit`: Whether Nx cache was hit

**Features**:

- npm dependency caching (`~/.npm`)
- Nx build cache (`.nx/cache`, `node_modules/.cache/nx`)
- Cache key includes `package-lock.json` hash and commit SHA
- Fallback to previous caches for faster cold starts

**Note**: Node.js version is hardcoded to 24.13.0 to match package.json engines.

### nx-affected

Calculates affected projects using Nx based on git changes.

**Inputs**:

- `base-ref` (required): Base git reference for comparison
- `head-ref` (optional): Head git reference (default: HEAD)
- `targets` (optional): Comma-separated list of targets to check

**Outputs**:

- `affected-projects`: Comma-separated list of affected project names
- `has-affected`: Boolean indicating if there are any affected projects
- `projects-json`: JSON array of affected project names

### run-checks

Runs specific checks (format, lint, test, build, e2e) for all or affected projects.

**Inputs**:

- `check-type` (required): Type of check (format, lint, test, build, e2e)
- `affected-only` (optional): Whether to run only on affected projects
- `affected-projects` (optional): Comma-separated list of affected projects

## Security Features

### Pinned Action Versions

All third-party actions are pinned to specific commit SHAs for security:

- `actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd` (v6.0.2)
- `actions/setup-node@6044e13b5dc448c55e2357c09f80417699197238` (v6.2.0)
- `actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02` (v4.6.2)
- `actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093` (v4.3.0)
- `actions/cache@cdf6c1fa76f9f475f3d7449005a359c84ca0f306` (v5.0.3)
- `codecov/codecov-action@0561704f0f02c16a585d4c7555e57fa2e44cf909` (v5.5.2)
- `dorny/paths-filter@de90cc6fb38fc0963ad72b210f1f284cd68cea36` (v3.0.2)

### Dependabot

Automatic dependency updates are configured in [dependabot.yml](../dependabot.yml):

- GitHub Actions: Weekly security updates only
- npm packages: Weekly updates with open-pull-requests limit of 10

### Permissions

All workflows use minimal permissions:

- Default: `contents: read` (read-only)
- Security scanning: Additional `security-events: write` permission

## Local Testing

Use [act](https://github.com/nektos/act) to test workflows locally. See [test-events/README.md](../test-events/README.md) for detailed instructions.

Quick examples:

```bash
# Test PR workflow
act pull_request -W .github/workflows/ci-pr.yml

# Test main branch workflow
act push -W .github/workflows/ci-main.yml

# Test specific job
act pull_request -j format -W .github/workflows/ci-pr.yml
```

## Performance Metrics

**Target Performance**:

- PR workflows: < 10 minutes
- Main branch workflows: < 15 minutes
- Cache hit rate: > 50%

**Optimizations**:

- Nx affected calculations reduce PR check time
- npm dependency caching
- Parallel execution (up to 3 concurrent tasks)
- Job-level parallelization

## Troubleshooting

### Workflow Not Triggering

- Check branch protection rules require the correct status check name
- Verify workflow trigger conditions match your branch/event
- Check workflow file syntax with `act --list`

### Cache Not Working

- Clear the cache: Go to Actions → Caches → Delete cache
- Verify `package-lock.json` hasn't changed unexpectedly
- Check cache key generation in workflow logs

### Affected Calculation Issues

- Ensure `fetch-depth: 0` is set in checkout step
- Verify base-ref points to the correct branch
- Check Nx configuration in `nx.json`

### Failed Jobs

- Review job logs in GitHub Actions UI
- Test locally with `act` to reproduce
- Check for missing dependencies or configuration

## Migration Notes

### From ci.yml to ci-pr.yml + ci-main.yml

The original `ci.yml` workflow has been split into two workflows:

- **ci-pr.yml**: Optimized for fast PR validation using affected projects
- **ci-main.yml**: Comprehensive validation of all projects on main branch

**Key Changes**:

- PR checks now run only on affected projects (faster)
- Main branch checks run on all projects (more thorough)
- Custom actions replace inline steps (reusable)
- Security hardening with pinned action versions
- Better cache management and parallel execution

**Rollback**: If needed, the legacy workflow is preserved in `ci-legacy.yml`

## Maintenance

### Weekly Tasks

- Review and merge Dependabot PRs
- Check workflow performance metrics
- Monitor cache hit rates

### Monthly Tasks

- Review workflow execution times
- Audit action version updates
- Check for unused or deprecated workflows

### Quarterly Tasks

- Review security scan results
- Update documentation
- Optimize slow workflows
- Consider Nx Cloud for further optimization

## Future Enhancements

Planned but not yet implemented:

- Demo app deployments
- Nx Cloud integration for remote caching (cross-workflow/cross-branch)
