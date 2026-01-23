# GitHub Workflows Refactoring Plan

**Status**: Implemented (PR #2)
**Created**: January 22, 2026
**Last Updated**: January 23, 2026
**Owner**: @AndrewRedican

---

## Executive Summary

This document outlines the refactoring of hyperfrontend's CI/CD workflows for improved **maintainability**, **security**, and **efficiency**.

**Key Improvements Implemented:**

- ✅ Modular, reusable custom actions
- ✅ Security hardening (minimal permissions, pinned dependencies)
- ✅ Nx affected optimization for faster CI
- ✅ Clear separation of trusted vs untrusted workflows
- ✅ Contributor type suggestion automation

**Timeline:** 4-6 weeks
**Risk Level:** Low (incremental changes with rollback capability)

---

## Architecture Overview

### Custom Actions

Three reusable actions form the foundation:

1. **setup-monorepo** - Node.js environment with caching
2. **nx-affected** - Calculate affected projects
3. **run-checks** - Execute format, lint, build, test, e2e

### Workflows

| Workflow              | Trigger       | Purpose                    | Affected          |
| --------------------- | ------------- | -------------------------- | ----------------- |
| `ci pr`               | Pull requests | Validate changes           | Yes ✅            |
| `ci`                  | Push to main  | Full validation            | No (all projects) |
| `security`            | Weekly + PRs  | Security scanning          | N/A               |
| `deploy docs`         | Push to main  | Documentation deployment   | N/A               |
| `contributor suggest` | PR approval   | Suggest contribution types | N/A               |
| `cla`                 | PR events     | CLA signature check        | N/A               |

---

## Security Hardening

### Implemented Controls

1. **Pinned Dependencies** - All actions use commit SHA with version comments
2. **Minimal Permissions** - Default `contents: read`, explicit grants per job
3. **Trusted vs Untrusted** - Separate workflows for forked PRs
4. **Dependency Scanning** - Dependabot + CodeQL + npm audit

### Permission Matrix

| Workflow              | Permissions                                             | Trust Level         |
| --------------------- | ------------------------------------------------------- | ------------------- |
| `ci pr`               | `contents: read`                                        | LOW (Untrusted)     |
| `ci`                  | `contents: read`                                        | MEDIUM (Trusted)    |
| `security`            | `contents: read`<br>`security-events: write`            | MEDIUM (Trusted)    |
| `deploy docs`         | `contents: read`<br>`pages: write`<br>`id-token: write` | HIGH (Trusted)      |
| `contributor suggest` | `contents: read`<br>`pull-requests: write`              | MEDIUM (Owner only) |

---

## Performance Optimization

### Nx Affected Analysis

- PRs run 50-80% faster (only test changed code)
- Main branch runs everything (catch integration issues)
- Empty affected projects handled gracefully

### Caching Strategy

- npm dependencies cached via `actions/setup-node`
- Nx computation cache (local)
- Future: Nx Cloud for remote caching

---

## Testing Strategy

### Local Testing with Act

```bash
# Test PR workflow
act pull_request -W .github/workflows/ci-pr.yml

# Test specific job
act -j format

# Use test event
act pull_request --eventpath .github/test-events/pr-opened.json
```

### Validation Checklist

- [ ] All jobs complete successfully
- [ ] Affected calculation works correctly
- [ ] Cache hit rate >50%
- [ ] PR workflow <10 minutes
- [ ] Main workflow <15 minutes
- [ ] No secrets in logs

---

## Rollback Procedures

If critical issues arise:

1. Re-enable legacy workflow by restoring trigger events
2. Update branch protection to require old status check
3. Disable new workflows temporarily
4. Investigate issues offline
5. Fix and retest before re-deploying

---

## Future Enhancements

### Deployment Workflows

- Demo apps deployment (vendor/host TBD)
- Automated releases with changelogs

### Package Publishing

- npm publishing with provenance
- CDN uploads for standalone builds

### Advanced Optimization

- Nx Cloud for remote caching
- Distributed task execution
- Workflow health monitoring

---

## Reference Commands

```bash
# Test affected locally
npx nx show projects --affected --base=origin/main --head=HEAD

# Run checks for affected projects
npx nx run-many -t=test --projects=$(npx nx show projects --affected --base=origin/main --head=HEAD | tr '\n' ',')

# Check action versions
gh api repos/actions/checkout/commits/v4 --jq '.sha'

# Local workflow testing
act pull_request -W .github/workflows/ci-pr.yml -s GITHUB_TOKEN="$(gh auth token)"
```

---

## Resources

- [GitHub Actions Security](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [Nx Affected Commands](https://nx.dev/ci/features/affected)
- [Act - Local Testing](https://github.com/nektos/act)
- [Dependabot Configuration](https://docs.github.com/en/code-security/dependabot)

        # Convert to JSON array
        PROJECTS_JSON=$(echo "$AFFECTED" | jq -R -s -c 'split(" ") | map(select(length > 0))')

        echo "projects=$PROJECTS_CSV" >> $GITHUB_OUTPUT
        echo "has-affected=true" >> $GITHUB_OUTPUT
        echo "projects-json=$PROJECTS_JSON" >> $GITHUB_OUTPUT

        echo "✅ Affected projects: $PROJECTS_CSV"

````

**Testing:**

```bash
# Test in a feature branch
git checkout -b test/affected-action
# Make a change
echo "test" >> packages/data/src/index.ts
git add . && git commit -m "test: affected calculation"

# Run the action
act -j test-affected
````

---

#### Action 1.3: `run-checks`

Executes code quality checks (format, lint, test, build).

**File:** `.github/actions/run-checks/action.yml`

```yaml
name: Run Checks
description: Execute formatting, linting, testing, or building

inputs:
  check-type:
    description: 'Type of check to run: format, lint, test, build, e2e'
    required: true
  affected-only:
    description: 'Whether to run only on affected projects'
    required: false
    default: 'false'
  affected-projects:
    description: 'Comma-separated list of affected projects (if affected-only=true)'
    required: false
    default: ''

outputs:
  success:
    description: 'Whether the check passed'
    value: ${{ steps.run.outputs.success }}

runs:
  using: composite
  steps:
    - name: Run check
      id: run
      shell: bash
      run: |
        CHECK_TYPE="${{ inputs.check-type }}"
        AFFECTED_ONLY="${{ inputs.affected-only }}"
        AFFECTED_PROJECTS="${{ inputs.affected-projects }}"

        # Determine Nx command
        case "$CHECK_TYPE" in
          format)
            TARGET="format:check"
            ;;
          lint)
            TARGET="lint"
            ;;
          test)
            TARGET="test"
            ;;
          build)
            TARGET="build"
            ;;
          e2e)
            TARGET="e2e"
            ;;
          *)
            echo "❌ Unknown check type: $CHECK_TYPE"
            exit 1
            ;;
        esac

        # Build command
        if [ "$AFFECTED_ONLY" = "true" ] && [ -n "$AFFECTED_PROJECTS" ]; then
          echo "🎯 Running $TARGET for affected projects: $AFFECTED_PROJECTS"
          npx nx run-many -t="$TARGET" --projects="$AFFECTED_PROJECTS" --parallel=3
        elif [ "$AFFECTED_ONLY" = "true" ]; then
          echo "ℹ️ No affected projects, skipping $TARGET"
          exit 0
        else
          echo "🔄 Running $TARGET for all projects"
          npx nx run-many -t="$TARGET" --all --parallel=3
        fi

        echo "success=true" >> $GITHUB_OUTPUT
```

---

**Deliverables for Step 1:**

- ✅ 3 custom actions created and tested
- ✅ Documentation with usage examples
- ✅ No breaking changes (actions not yet used)

---

### Step 2: Security Hardening (Week 2)

**Goal:** Harden security before integrating new workflows

**Dependencies:** None (parallel with Step 1)

#### Task 2.1: Pin Third-Party Actions

Update all workflows to pin actions to commit SHA instead of tags.

**Before:**

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
```

**After:**

```yaml
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
- uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2
```

**Why:** Prevents supply chain attacks if action repository is compromised.

**Implementation:**

```bash
# Get current commit SHA for an action
gh api repos/actions/checkout/commits/v4.1.1 --jq '.sha'
# Output: b4ffde65f46336ab88eb53be808477a3936bae11
```

---

#### Task 2.2: Add Dependabot

Enable automated dependency updates and security scanning.

**File:** `.github/dependabot.yml`

```yaml
version: 2
updates:
  # GitHub Actions
  - package-ecosystem: 'github-actions'
    directory: '/'
    schedule:
      interval: 'weekly'
    labels:
      - 'dependencies'
      - 'github-actions'
    commit-message:
      prefix: 'chore(deps)'

  # NPM dependencies
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
    labels:
      - 'dependencies'
    commit-message:
      prefix: 'chore(deps)'
    # Only security updates for now
    open-pull-requests-limit: 10
    ignore:
      - dependency-name: '*'
        update-types: ['version-update:semver-major', 'version-update:semver-minor']
```

---

#### Task 2.3: Enable CodeQL

Add security scanning for code vulnerabilities.

**File:** `.github/workflows/security-scan.yml`

```yaml
name: Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    # Run weekly on Mondays at 9am UTC
    - cron: '0 9 * * 1'

permissions:
  contents: read
  security-events: write

jobs:
  codeql:
    name: CodeQL Analysis
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: javascript

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3

  dependency-audit:
    name: Dependency Audit
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

      - name: Setup Node.js
        uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2
        with:
          node-version: '24.x'

      - name: Run npm audit
        run: |
          npm audit --audit-level=high
          # Check for high/critical vulnerabilities
          AUDIT_RESULT=$(npm audit --audit-level=high --json)
          HIGH_COUNT=$(echo "$AUDIT_RESULT" | jq '.metadata.vulnerabilities.high // 0')
          CRITICAL_COUNT=$(echo "$AUDIT_RESULT" | jq '.metadata.vulnerabilities.critical // 0')

          if [ "$HIGH_COUNT" -gt 0 ] || [ "$CRITICAL_COUNT" -gt 0 ]; then
            echo "❌ Found $HIGH_COUNT high and $CRITICAL_COUNT critical vulnerabilities"
            exit 1
          fi

          echo "✅ No high or critical vulnerabilities found"
```

---

**Deliverables for Step 2:**

- ✅ All actions pinned to commit SHA
- ✅ Dependabot configured
- ✅ CodeQL scanning enabled
- ✅ Dependency auditing automated

---

### Step 3: Refactor CI Workflow (Week 3-4)

**Goal:** Split monolithic CI into modular workflows using custom actions

**Dependencies:** Steps 1 & 2 complete

#### Workflow 3.1: PR Validation (Untrusted)

Safe for forked PRs, no write access or secrets.

**File:** `.github/workflows/ci-pr.yml`

```yaml
name: CI - Pull Request

on:
  pull_request:
    branches: [main]

# Default to read-only for security
permissions:
  contents: read

concurrency:
  group: ci-pr-${{ github.ref }}
  cancel-in-progress: true

jobs:
  setup:
    name: Setup and Calculate Affected
    runs-on: ubuntu-latest
    outputs:
      affected-projects: ${{ steps.affected.outputs.affected-projects }}
      has-affected: ${{ steps.affected.outputs.has-affected }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
        with:
          fetch-depth: 0 # Need full history for affected calculation

      - name: Setup monorepo
        uses: ./.github/actions/setup-monorepo

      - name: Calculate affected projects
        id: affected
        uses: ./.github/actions/nx-affected
        with:
          base-ref: origin/${{ github.base_ref }}
          head-ref: HEAD

  format:
    name: Format Check
    needs: [setup]
    runs-on: ubuntu-latest
    if: needs.setup.outputs.has-affected == 'true'

    steps:
      - name: Checkout repository
        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

      - name: Setup monorepo
        uses: ./.github/actions/setup-monorepo

      - name: Run format check
        uses: ./.github/actions/run-checks
        with:
          check-type: format
          affected-only: 'true'
          affected-projects: ${{ needs.setup.outputs.affected-projects }}

  lint:
    name: Lint
    needs: [setup]
    runs-on: ubuntu-latest
    if: needs.setup.outputs.has-affected == 'true'

    steps:
      - name: Checkout repository
        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

      - name: Setup monorepo
        uses: ./.github/actions/setup-monorepo

      - name: Run lint
        uses: ./.github/actions/run-checks
        with:
          check-type: lint
          affected-only: 'true'
          affected-projects: ${{ needs.setup.outputs.affected-projects }}

  build:
    name: Build
    needs: [setup]
    runs-on: ubuntu-latest
    if: needs.setup.outputs.has-affected == 'true'

    steps:
      - name: Checkout repository
        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

      - name: Setup monorepo
        uses: ./.github/actions/setup-monorepo

      - name: Run build
        uses: ./.github/actions/run-checks
        with:
          check-type: build
          affected-only: 'true'
          affected-projects: ${{ needs.setup.outputs.affected-projects }}

  test:
    name: Test
    needs: [setup, build]
    runs-on: ubuntu-latest
    if: needs.setup.outputs.has-affected == 'true'

    steps:
      - name: Checkout repository
        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

      - name: Setup monorepo
        uses: ./.github/actions/setup-monorepo

      - name: Run tests
        uses: ./.github/actions/run-checks
        with:
          check-type: test
          affected-only: 'true'
          affected-projects: ${{ needs.setup.outputs.affected-projects }}

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: coverage/
          retention-days: 7

  ci-status:
    name: CI Status Check
    runs-on: ubuntu-latest
    needs: [setup, format, lint, build, test]
    if: always()

    steps:
      - name: Check job results
        run: |
          # If no affected projects, consider it a success
          if [ "${{ needs.setup.outputs.has-affected }}" = "false" ]; then
            echo "✅ No affected projects - CI passes"
            exit 0
          fi

          # Check if any required job failed
          if [ "${{ needs.format.result }}" = "failure" ] || \
             [ "${{ needs.lint.result }}" = "failure" ] || \
             [ "${{ needs.build.result }}" = "failure" ] || \
             [ "${{ needs.test.result }}" = "failure" ]; then
            echo "❌ CI failed"
            exit 1
          fi

          echo "✅ CI passed"
```

---

#### Workflow 3.2: Main Branch CI (Trusted)

Runs all checks without affected filtering for comprehensive validation.

**File:** `.github/workflows/ci-main.yml`

```yaml
name: CI - Main Branch

on:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-main-${{ github.ref }}
  cancel-in-progress: false # Don't cancel main branch builds

jobs:
  setup:
    name: Setup Environment
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

      - name: Setup monorepo
        uses: ./.github/actions/setup-monorepo
        with:
          install-hugo: 'true'

  format:
    name: Format Check
    needs: [setup]
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

      - name: Setup monorepo
        uses: ./.github/actions/setup-monorepo

      - name: Run format check (all projects)
        uses: ./.github/actions/run-checks
        with:
          check-type: format
          affected-only: 'false'

  lint:
    name: Lint
    needs: [setup]
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

      - name: Setup monorepo
        uses: ./.github/actions/setup-monorepo

      - name: Run lint (all projects)
        uses: ./.github/actions/run-checks
        with:
          check-type: lint
          affected-only: 'false'

  build:
    name: Build
    needs: [setup]
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

      - name: Setup monorepo
        uses: ./.github/actions/setup-monorepo

      - name: Run build (all projects)
        uses: ./.github/actions/run-checks
        with:
          check-type: build
          affected-only: 'false'

  test:
    name: Test with Coverage
    needs: [setup, build]
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

      - name: Setup monorepo
        uses: ./.github/actions/setup-monorepo

      - name: Run tests (all projects)
        uses: ./.github/actions/run-checks
        with:
          check-type: test
          affected-only: 'false'

      - name: Check coverage thresholds
        run: npx nx run-many -t=coverage-check --all

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-main
          path: coverage/
          retention-days: 30

  e2e:
    name: E2E Tests
    needs: [setup, build]
    runs-on: ubuntu-latest
    if: false # Enable when E2E tests exist

    steps:
      - name: Checkout repository
        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

      - name: Setup monorepo
        uses: ./.github/actions/setup-monorepo

      - name: Run E2E tests
        uses: ./.github/actions/run-checks
        with:
          check-type: e2e
          affected-only: 'false'

  ci-status:
    name: CI Status Check
    runs-on: ubuntu-latest
    needs: [format, lint, build, test]
    if: always()

    steps:
      - name: Check job results
        run: |
          if [ "${{ needs.format.result }}" = "failure" ] || \
             [ "${{ needs.lint.result }}" = "failure" ] || \
             [ "${{ needs.build.result }}" = "failure" ] || \
             [ "${{ needs.test.result }}" = "failure" ]; then
            echo "❌ CI failed on main branch"
            exit 1
          fi

          echo "✅ CI passed on main branch"
```

---

**Deliverables for Step 3:**

- ✅ Separate workflows for PR and main branch
- ✅ Nx affected optimization for PRs
- ✅ All checks run on main (integration testing)
- ✅ Explicit minimal permissions
- ✅ Actions pinned to commit SHA

---

### Step 4: Migration and Validation (Week 5)

**Goal:** Safely transition from old to new workflows

**Dependencies:** Step 3 complete

#### Phase 4.1: Parallel Run (Week 5, Days 1-3)

Run both old and new workflows simultaneously.

1. **Rename old workflow:** `ci.yml` → `ci-legacy.yml`
2. **Deploy new workflows:** `ci-pr.yml` and `ci-main.yml`
3. **Update branch protection:** Require `ci-status` from BOTH workflows
4. **Monitor:** Compare results for 3-5 days

**Success Criteria:**

- New workflows complete successfully
- New workflows ≤ old workflow duration
- No false positives/negatives

---

#### Phase 4.2: Cutover (Week 5, Days 4-5)

1. **Update branch protection:** Require only new `ci-status`
2. **Disable old workflow:** Remove trigger events from `ci-legacy.yml`
3. **Monitor:** Watch for issues for 48 hours
4. **Document:** Update CONTRIBUTING.md with new workflow info

---

#### Phase 4.3: Cleanup (Week 6)

1. **Delete old workflow:** Remove `ci-legacy.yml`
2. **Archive documentation:** Note migration in commit message
3. **Celebrate:** 🎉

---

**Deliverables for Step 4:**

- ✅ Migration complete
- ✅ Old workflow removed
- ✅ Documentation updated
- ✅ Team trained on new system

---

## Testing Strategy

### Local Testing with Act

Test workflows locally before pushing:

```bash
# Install act
brew install act  # macOS
# or
curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Test PR workflow
act pull_request -W .github/workflows/ci-pr.yml

# Test specific job
act -j format

# Test custom action
act --action .github/actions/setup-monorepo

# Use specific event
act pull_request --eventpath .github/test-events/pr-opened.json
```

### Test Event Files

Create test events for consistent testing:

**File:** `.github/test-events/pr-opened.json`

```json
{
  "pull_request": {
    "number": 1,
    "base": {
      "ref": "main"
    },
    "head": {
      "ref": "test/feature"
    }
  }
}
```

### Validation Checklist

Before merging workflow changes:

#### Functional

- [ ] All jobs complete successfully
- [ ] Affected calculation works correctly
- [ ] Empty affected case handled gracefully
- [ ] Caching works (check logs for cache hits)
- [ ] Error messages are clear and actionable

#### Security

- [ ] All third-party actions pinned to SHA
- [ ] Minimal permissions declared per job
- [ ] No secrets in logs (test with dummy values)
- [ ] Forked PRs cannot access sensitive resources

#### Performance

- [ ] PR workflow completes in <10 minutes
- [ ] Main workflow completes in <15 minutes
- [ ] Cache hit rate >50%
- [ ] Parallel jobs utilized effectively

---

## Security Controls

### Permission Matrix

| Workflow            | Trigger             | Permissions                                  | Secrets | Trust Level          |
| ------------------- | ------------------- | -------------------------------------------- | ------- | -------------------- |
| `ci-pr.yml`         | `pull_request`      | `contents: read`                             | None    | **LOW** (Untrusted)  |
| `ci-main.yml`       | `push` (main)       | `contents: read`                             | None    | **MEDIUM** (Trusted) |
| `security-scan.yml` | `schedule` / `push` | `contents: read`<br>`security-events: write` | None    | **MEDIUM** (Trusted) |

### Security Best Practices Applied

1. **Pinned Dependencies**
   - All actions use full commit SHA
   - Comments include version tag for readability
   - Example: `actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1`

2. **Minimal Permissions**
   - Default: `contents: read` (read-only)
   - Grant additional permissions explicitly per job
   - Never use `write-all` or `permissions: {}`

3. **Trusted vs Untrusted**
   - `pull_request`: Runs on forked PRs, no secrets
   - `push`: Runs only on trusted branches, can have secrets (if needed)
   - Clear separation prevents secret exfiltration

4. **Input Validation**
   - All custom action inputs have descriptions
   - Boolean inputs checked explicitly
   - Unknown values fail fast with clear errors

5. **Dependency Scanning**
   - Dependabot monitors for vulnerable dependencies
   - CodeQL scans for code vulnerabilities
   - npm audit checks package security

---

## Success Criteria

### Must Have (Week 6)

- ✅ All workflows migrated and working
- ✅ Nx affected reduces PR CI time by >50%
- ✅ Zero high/critical security vulnerabilities
- ✅ All third-party actions pinned to SHA
- ✅ Documentation complete

### Nice to Have (Future)

- ⏳ CI time <5 minutes for typical PRs
- ⏳ Deployment workflows (docs, apps)
- ⏳ Package publishing automation
- ⏳ Nx Cloud integration for remote caching

---

## Rollback Plan

If critical issues arise:

### Immediate Rollback (<5 minutes)

1. Re-enable old workflow: Restore trigger events in `ci-legacy.yml`
2. Update branch protection: Require old `ci-status` check
3. Disable new workflows: Remove trigger events

### Investigate Offline

1. Review workflow logs for errors
2. Test fixes in separate branch
3. Validate with parallel run again

### Redeploy When Ready

1. Fix issues in new workflows
2. Repeat parallel run phase
3. Complete cutover again

---

## Common Issues and Solutions

### Issue: "Affected calculation failed"

**Symptoms:**

```
Error: fatal: ambiguous argument 'origin/main': unknown revision
```

**Solution:**

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0 # Need full history for affected
```

---

### Issue: "No affected projects, CI fails"

**Solution:**

```yaml
# In ci-status job
if [ "${{ needs.setup.outputs.has-affected }}" = "false" ]; then
echo "✅ No affected projects - CI passes"
exit 0
fi
```

---

### Issue: "Cache not working"

**Solution:**

```yaml
# Ensure lock file is committed
git add package-lock.json
git commit -m "chore: update lock file"

# Use npm ci, not npm install
run: npm ci --no-audit --prefer-offline
```

---

## Next Steps After Completion

Once this refactoring is complete, the foundation is in place for:

1. **Deployment Workflows** - Automate docs and app deployments
2. **Package Publishing** - Publish to npm with provenance
3. **Advanced Optimizations** - Nx Cloud, remote caching
4. **Additional Security** - SBOM generation, provenance attestations

These can be tackled incrementally as needs arise, without reworking the foundation.

---

## Appendix

### Useful Commands

```bash
# Test affected locally
npx nx show projects --affected --base=origin/main --head=HEAD

# Run checks for affected projects
npx nx run-many -t=test --projects=$(npx nx show projects --affected --base=origin/main --head=HEAD | tr '\n' ',')

# Check for outdated actions
gh api repos/actions/checkout/commits/v4 --jq '.sha'

# Local workflow testing
act pull_request -W .github/workflows/ci-pr.yml -s GITHUB_TOKEN="$(gh auth token)"
```

### Resources

- [GitHub Actions Security Hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [Nx Affected Commands](https://nx.dev/ci/features/affected)
- [Act - Local GitHub Actions](https://github.com/nektos/act)
- [Dependabot Configuration](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file)
