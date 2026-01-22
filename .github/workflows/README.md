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

**Jobs**:

- `setup`: Calculates affected projects using Nx
- `format`: Format checking (affected only)
- `lint`: Linting (affected only)
- `build`: Build (affected only)
- `test`: Testing with coverage upload (affected only)
- `ci-status`: Aggregates results and provides final status

### CI - Main Branch ([ci-main.yml](./ci-main.yml))

**Trigger**: Pushes to `main` branch
**Purpose**: Comprehensive validation of all projects

**Features**:

- Runs checks on ALL projects (not just affected)
- Includes coverage threshold checking
- Does not cancel in-progress runs (safer for main branch)
- Longer retention for coverage reports (30 days)
- Installs Hugo for documentation builds

**Jobs**:

- `setup`: Environment setup with Hugo
- `format`: Format checking (all projects)
- `lint`: Linting (all projects)
- `build`: Build (all projects)
- `test`: Testing with coverage thresholds (all projects)
- `e2e`: E2E tests (placeholder, currently disabled)
- `ci-status`: Aggregates results and provides final status

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

Sets up the Node.js environment, caches npm dependencies, and installs packages.

**Inputs**:

- `install-hugo` (optional): Whether to install Hugo for documentation builds
- `node-version` (optional): Node.js version to use (default: 20)

**Outputs**:

- `cache-hit`: Whether npm cache was hit

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

- `actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11` (v4.1.1)
- `actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8` (v4.0.2)
- `actions/upload-artifact@5d5d22a31266ced268874388b861e4b58bb5c2f3` (v4.3.1)
- `actions/cache@0c45773b623bea8c8e75f6c82b208c3cf94ea4f9` (v4.0.2)

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

- E2E testing workflow (currently placeholder)
- Demo app deployments
- Package publishing automation
- Release automation
- Nx Cloud integration for remote caching
