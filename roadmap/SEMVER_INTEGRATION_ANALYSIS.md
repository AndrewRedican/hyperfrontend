# @jscutlery/semver Integration Analysis

**Created**: February 8, 2026
**Purpose**: Deep comparison between `@jscutlery/semver` behavior and the custom versioning automation to identify misalignments and potential bugs.

---

## Executive Summary

This document analyzes the integration between `@jscutlery/semver` (the underlying versioning library) and `@hyperfrontend/package:version` (the custom idempotent wrapper). Several critical misalignments were identified that could cause bugs in the versioning workflow.

| Severity    | Issue                                            | Status               |
| ----------- | ------------------------------------------------ | -------------------- |
| 🔴 Critical | Tags never created due to `--skipTag` everywhere | **Needs Fix**        |
| 🔴 Critical | Output parsing mismatches actual output          | **Needs Fix**        |
| 🟡 Medium   | Missing `--skipStage` for parallel execution     | **Needs Fix**        |
| 🟡 Medium   | `--check-only` flag doesn't exist                | **Needs Fix**        |
| 🟢 Low      | Tag format is customized (@ vs -)                | **OK** (intentional) |
| 🟢 Low      | Version source differs (tags vs package.json)    | **OK** (by design)   |

---

## Component Comparison

### Version Determination

| Aspect         | @jscutlery/semver               | Custom Wrapper                       |
| -------------- | ------------------------------- | ------------------------------------ |
| Version source | Git tags only                   | Package.json (for idempotency check) |
| Tag format     | `{projectName}-x.y.z` (default) | `{projectName}@x.y.z` (configured)   |
| No tag exists  | Starts from `0.0.0`             | Delegates to semver                  |
| Multiple runs  | Creates duplicate bumps         | Idempotent (skips if tagged)         |

**Analysis**: The different version sources are intentional and correct. The wrapper reads `package.json` only to check if that version is already tagged—if so, skip; if not, delegate to semver which uses its tag-based logic.

### Tag Format Configuration

```
@jscutlery/semver default:  {projectName}-{version}  →  lib-nexus-1.0.0
Our configuration:          {projectName}@{version}  →  lib-nexus@1.0.0
```

**Configured in**: `nx.json` → `targetDefaults.version.options.tagPrefix`

```json
{
  "tagPrefix": "{projectName}@"
}
```

**Status**: ✅ Consistent throughout codebase. The `@` format is a valid npm convention (matches npm tag format).

---

## Critical Issues Identified

### Issue 1: Tags Never Created 🔴

**Problem**: The versioning workflow uses `--skipTag` at every stage, meaning git tags are never created.

| Stage            | Command                                 | Result             |
| ---------------- | --------------------------------------- | ------------------ |
| Post-commit hook | `nx version lib --skipCommit --skipTag` | ❌ No tag          |
| PR Validation    | `nx version lib --skipCommit --skipTag` | ❌ No tag          |
| Release workflow | `git push origin --tags`                | ❌ No tags to push |

**Expected Flow**:

```
Developer commit → version (no tag) → PR merge → create tags → push tags → publish
```

**Actual Flow**:

```
Developer commit → version (no tag) → PR merge → push tags (none exist!) → publish fails
```

**Root Cause**: The plan states "Tags are created during the version command (locally or in PR validation)" but `--skipTag` prevents this.

**Solution**: Remove `--skipTag` from PR validation step, or add a dedicated tag creation step before publish.

---

### Issue 2: Output String Mismatch 🔴

**Problem**: The post-commit script parses output strings that don't match the actual executor output.

**Post-commit script expects**:

```javascript
if (result.includes('version updated')) {
  /* ... */
}
if (result.includes('already versioned')) {
  /* ... */
}
```

**Actual executor output**:

```typescript
// When skipping:
logger.info(`${projectName}: Tag ${expectedTag} already exists (skipping)`)

// When delegating:
logger.info(`${projectName}: Delegating to @jscutlery/semver:version`)
// Then @jscutlery/semver outputs its own format
```

| Expected String       | Actual Output                 | Match?     |
| --------------------- | ----------------------------- | ---------- |
| `"version updated"`   | (semver internal output)      | ❌ Unknown |
| `"already versioned"` | `"already exists (skipping)"` | ❌ No      |

**Impact**: Post-commit script can't detect whether versions were updated, breaking the commit-amend logic.

**Solution**: Update executor to output consistent, parseable strings, or update post-commit script to match actual output.

---

### Issue 3: Missing --skipStage Flag 🟡

**Problem**: `@jscutlery/semver` may stage files unexpectedly when `--skipCommit` is used without `--skipStage`.

**From DEPLOYMENT_PUBLISHING.md**:

> The `--skipStage --skipCommit` flags are required for dry-run due to a behavior in @jscutlery/semver where `--dryRun` alone still attempts to stage files.

**Current post-commit command**:

```bash
npx nx version ${lib} --skipCommit --skipTag  # Missing --skipStage!
```

**Risk**: When the post-commit hook runs `nx version`, semver might stage files immediately, interfering with the subsequent `git add` and `git commit --amend` operations.

**Solution**: Add `--skipStage` to all non-commit version commands:

```bash
npx nx version ${lib} --skipCommit --skipTag --skipStage
```

---

### Issue 4: Non-Existent --check-only Flag 🟡

**Problem**: The VERSIONING_AUTOMATION_PLAN.md references a `--check-only` flag that doesn't exist.

**Plan snippet** (Phase 3.1):

```yaml
RESULT=$(npx nx version $lib --check-only 2>&1) || true
if echo "$RESULT" | grep -q "needs version update"; then
```

**Actual schema.json**: No `checkOnly` property defined.

**Current CI workflow** (ci-pr.yml): Does NOT use `--check-only`, runs version directly.

**Impact**: Documentation is misleading, though the actual implementation works around this.

**Solution**: Either implement `--check-only` mode or remove references from documentation.

---

## Behavior Comparison Matrix

### Options Pass-Through

| Option              | In schema.json | Passed to semver | Notes                      |
| ------------------- | -------------- | ---------------- | -------------------------- |
| `dryRun`            | ✅             | ✅               | Preview mode               |
| `push`              | ✅             | ✅               | Push to remote             |
| `releaseAs`         | ✅             | ✅               | Force bump type            |
| `preid`             | ✅             | ✅               | Prerelease identifier      |
| `tagPrefix`         | ✅             | ✅               | Custom tag format          |
| `postTargets`       | ✅             | ✅               | Post-version targets       |
| `trackDeps`         | ✅             | ✅               | Dependency-aware bumps     |
| `allowEmptyRelease` | ✅             | ✅               | Force bump without changes |
| `skipCommit`        | ✅             | ✅               | Skip git commit            |
| `skipTag`           | ✅             | ✅               | Skip git tag               |
| `skipStage`         | ❌             | ❌               | **Missing!**               |
| `skipCommitTypes`   | ❌             | ❌               | Could be useful            |
| `syncVersions`      | ❌             | ❌               | N/A (independent mode)     |

### Idempotency Logic

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Idempotency Decision Tree                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   1. Read version from libs/{project}/package.json                  │
│         ↓                                                           │
│   2. Construct tag: {tagPrefix}{version}                            │
│      Example: "lib-nexus@1.2.3"                                     │
│         ↓                                                           │
│   3. Check if tag exists: `git rev-parse lib-nexus@1.2.3`           │
│         ↓                                                           │
│   ┌─────┴─────┐                                                     │
│   │           │                                                     │
│   ▼           ▼                                                     │
│ EXISTS     NOT EXISTS                                               │
│   │           │                                                     │
│   ▼           ▼                                                     │
│ Check for    Delegate to                                            │
│ overrides    @jscutlery/semver                                      │
│   │                                                                 │
│   ├── releaseAs set? ──YES──┐                                       │
│   │                         ▼                                       │
│   │                    Delegate                                     │
│   │                                                                 │
│   ├── allowEmptyRelease? ─YES─┐                                     │
│   │                           ▼                                     │
│   │                      Delegate                                   │
│   │                                                                 │
│   └── Neither ──────────────────▶ SKIP (return success)             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Workflow Flow Analysis

### Expected Flow (as documented)

```
1. Developer makes commits with conventional format
2. Post-commit hook runs `nx version` (idempotent)
3. Version/CHANGELOG updated, commit amended
4. Developer pushes PR
5. CI validates all checks pass
6. CI runs version-validation (fallback)
7. PR merged to main
8. Release workflow pushes tags
9. Release workflow publishes to npm
```

### Actual Flow (current implementation)

```
1. Developer makes commits ✅
2. Post-commit hook runs `nx version --skipCommit --skipTag` ✅
3. Version/CHANGELOG updated, BUT:
   - Output parsing may fail ⚠️
   - Files may be pre-staged ⚠️
4. Commit amend may or may not include changes ⚠️
5. Developer pushes PR ✅
6. CI validates, runs version-validation ✅
7. CI uses --skipTag, no tags created ❌
8. PR merged ✅
9. Release workflow: `git push --tags` pushes nothing ❌
10. GitHub Release creation fails (no tags) ❌
```

---

## @jscutlery/semver Internals

### How Version Bump is Calculated

1. **Find last tag**: `git-semver-tags` finds tags matching pattern
2. **Parse commits**: `conventional-commits-parser` parses commits since last tag
3. **Determine bump**: `conventional-recommended-bump` calculates bump type:
   - `feat:` → minor
   - `fix:` → patch
   - `BREAKING CHANGE:` → major
   - Merge commits → ignored
4. **Apply bump**: semver library increments version

### CHANGELOG Generation

Uses `conventional-changelog` with configurable preset (default: `angular`).

**Our config**: `preset: "conventionalcommits"`

```json
{
  "preset": "conventionalcommits"
}
```

This affects how commits are categorized and formatted in CHANGELOG.

### Post-Target Variables

Available when using `postTargets`:

| Variable        | Description   | Example             |
| --------------- | ------------- | ------------------- |
| `{projectName}` | Project name  | `lib-nexus`         |
| `{version}`     | New version   | `1.2.3`             |
| `{tag}`         | Full tag      | `lib-nexus@1.2.3`   |
| `{notes}`       | Release notes | (changelog excerpt) |
| `{previousTag}` | Previous tag  | `lib-nexus@1.2.2`   |
| `{dryRun}`      | Dry run flag  | `true`/`false`      |

**Opportunity**: Could use `postTargets` to automatically create tags and output consistent strings.

---

## Recommended Fixes

### Fix 1: Tag Creation Strategy

**Option A**: Remove `--skipTag` from PR validation

```yaml
# ci-pr.yml version-validation job
npx nx version $lib --skipCommit --skipStage # Creates tag locally
```

**Option B**: Add dedicated tag creation step

```yaml
# After version updates committed
- name: Create version tags
  run: |
    for lib in $UPDATED_LIBS; do
      VERSION=$(jq -r .version "libs/${lib#lib-}/package.json")
      git tag "${lib}@${VERSION}" 2>/dev/null || true
    done
```

**Recommended**: Option A is cleaner and leverages semver's built-in tag creation.

### Fix 2: Output Consistency

Update the executor to output consistent, parseable messages:

```typescript
// In executor.ts, after successful delegation:
export default async function versionExecutor(options, context) {
  // ... existing idempotency check ...

  if (tagExists(expectedTag, workspaceRoot) && !options.releaseAs && !options.allowEmptyRelease) {
    logger.info(`${projectName}: already versioned`) // Consistent string
    return { success: true }
  }

  logger.info(`${projectName}: Delegating to @jscutlery/semver:version`)
  const result = await semverVersion(options, context)

  if (result.success) {
    logger.info(`${projectName}: version updated`) // Consistent string
  }

  return result
}
```

### Fix 3: Add skipStage to Schema

```json
// schema.json
{
  "skipStage": {
    "type": "boolean",
    "description": "Skips staging of changes for commit. Use with --skipCommit for clean parallel execution.",
    "default": false
  }
}
```

Update all commands:

```bash
npx nx version lib --skipCommit --skipTag --skipStage
```

### Fix 4: Remove or Implement --check-only

Either:

- **Remove** references from VERSIONING_AUTOMATION_PLAN.md (current CI doesn't use it)
- **Implement** as a dry-run that only reports status without making changes

---

## Integration Opportunities

### 1. Use postTargets for Tagging

Instead of manual tag creation, configure semver's built-in mechanism:

```json
// nx.json
{
  "version": {
    "options": {
      "postTargets": ["create-tag"]
    }
  }
}
```

### 2. Use @jscutlery/semver:github Executor

The package includes a GitHub release executor:

```json
{
  "github-release": {
    "executor": "@jscutlery/semver:github",
    "options": {
      "tag": "{tag}",
      "notes": "{notes}"
    }
  }
}
```

Could replace the custom GitHub Actions script.

### 3. Dependency Tracking

Enable `trackDeps: true` to automatically bump libraries when their dependencies change:

```json
{
  "version": {
    "options": {
      "trackDeps": true
    }
  }
}
```

**Consideration**: Requires all projects in dependency chain to have version target configured.

---

## Testing Recommendations

### Unit Tests for Version Executor

```typescript
describe('versionExecutor', () => {
  it('should skip when tag exists', async () => {
    // Mock tagExists to return true
    // Verify semverVersion is NOT called
  })

  it('should delegate when tag does not exist', async () => {
    // Mock tagExists to return false
    // Verify semverVersion IS called
  })

  it('should delegate when releaseAs is provided even if tag exists', async () => {
    // Mock tagExists to return true
    // Pass releaseAs option
    // Verify semverVersion IS called (override behavior)
  })
})
```

### Integration Tests

1. **Fresh library**: No tags exist, verify version bump from 0.0.0
2. **Tagged library**: Tag exists at current version, verify skip
3. **Out-of-sync**: Tag exists but package.json manually changed
4. **Force bump**: Use --releaseAs to override idempotency

---

## Conclusion

The custom versioning wrapper provides valuable idempotency guarantees on top of `@jscutlery/semver`, but several implementation details need correction:

1. **Tags must be created** at some point in the workflow
2. **Output strings must match** what scripts parse
3. **skipStage should be used** to prevent file staging interference
4. **Documentation should match** actual implementation

With these fixes, the versioning automation will be robust and reliable.

---

## Related Documents

- [JSCUTLERY_SEMVER_ANALYSIS.md](./JSCUTLERY_SEMVER_ANALYSIS.md) — Library behavior reference
- [VERSIONING_AUTOMATION_PLAN.md](./VERSIONING_AUTOMATION_PLAN.md) — Implementation plan
- [BUILD_SYSTEM.md](./BUILD_SYSTEM.md) — Build architecture
- [DEPLOYMENT_PUBLISHING.md](./DEPLOYMENT_PUBLISHING.md) — Publishing workflow
