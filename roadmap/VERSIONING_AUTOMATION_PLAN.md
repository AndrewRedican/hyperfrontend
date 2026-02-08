# Versioning Automation Plan

**Created**: February 8, 2026

---

## Goals

1. **Self-contained PRs**: All version bumps and CHANGELOG updates are included in the PR itself
2. **No recursion potential**: CI should never trigger itself
3. **Idempotent operations**: Running version commands multiple times produces the same result
4. **Local-first**: Developers see version changes before pushing, no surprise `git pull` needed
5. **CI as fallback**: Pipeline validates and fills gaps, not the primary driver

---

## Architecture Overview

```
Developer commits (local)
         ↓
    lefthook post-commit
         ↓
    nx affected -t=version (local, idempotent)
         ↓
    CHANGELOG + package.json updated locally
         ↓
    Developer pushes to PR
         ↓
    ci-pr.yml runs checks
         ↓
    All checks pass
         ↓
    ci-pr.yml runs version validation/fallback
         ↓
    (If changes needed) Commit pushed to PR
         ↓
    PR merged to main
         ↓
    ci-release.yml (publish only, no versioning)
         ↓
    npm publish
```

**Key insight**: Versioning happens at commit time (local) and is validated at PR time. Release workflow only publishes - no version changes, no recursion possible.

---

## Phase 1: Idempotent Version Command

### 1.1 Create Custom Version Executor

The built-in @jscutlery/semver doesn't support idempotent operations. We need a wrapper or custom executor.

**Location**: `tools/package/src/executors/version/`

**Algorithm**:

```
function idempotentVersion(projectName):
    1. Get current version from libs/{project}/package.json
    2. Get last git tag for project: {projectName}@{lastVersion}
    3. Analyze commits since last tag using conventional-commits-parser
    4. Calculate expected version bump (major/minor/patch)
    5. Calculate expected new version

    IF current version >= expected version:
        RETURN "already versioned" (no-op)

    IF current version < expected version:
        Update package.json version
        Generate/update CHANGELOG.md entries
        RETURN "version updated"
```

**Files**:

```
tools/package/src/executors/version/
├── executor.ts           → Main executor
├── schema.json           → Executor schema
├── schema.d.ts           → TypeScript types
└── lib/
    ├── version-calculator.ts    → Calculates expected version from commits
    ├── changelog-generator.ts   → Generates CHANGELOG entries
    ├── changelog-updater.ts     → Updates existing CHANGELOG (idempotent)
    └── git-utils.ts             → Git operations (tags, commits)
```

### 1.2 Version Calculator Logic

```typescript
interface VersionCalculation {
  currentVersion: string // From package.json
  lastTaggedVersion: string // From git tags
  expectedVersion: string // Calculated from commits
  commits: ConventionalCommit[] // Commits since last tag
  bumpType: 'major' | 'minor' | 'patch' | 'none'
  isAlreadyVersioned: boolean // True if no action needed
}

function calculateVersion(projectName: string, projectRoot: string): VersionCalculation {
  // 1. Read current version
  const currentVersion = readPackageJsonVersion(projectRoot)

  // 2. Find last tag
  const lastTag = findLastTag(projectName) // e.g., "lib-nexus@0.0.1"
  const lastTaggedVersion = lastTag ? parseVersion(lastTag) : '0.0.0'

  // 3. Get commits since last tag (or all commits if no tag)
  const commits = getCommitsSince(lastTag, projectRoot)

  // 4. Analyze commits for bump type
  const bumpType = analyzeBumpType(commits)

  // 5. Calculate expected version
  const expectedVersion = incrementVersion(lastTaggedVersion, bumpType)

  // 6. Check if already versioned
  const isAlreadyVersioned = semver.gte(currentVersion, expectedVersion)

  return {
    currentVersion,
    lastTaggedVersion,
    expectedVersion,
    commits,
    bumpType,
    isAlreadyVersioned,
  }
}
```

### 1.3 CHANGELOG Updater (Idempotent)

The CHANGELOG updater must:

- Parse existing CHANGELOG.md
- Detect if version entry already exists
- Update entry if commits changed (rare edge case)
- Add new entry only if missing

```typescript
function updateChangelog(changelogPath: string, version: string, commits: ConventionalCommit[], date: string): { changed: boolean } {
  const content = readFileSync(changelogPath, 'utf-8')
  const parsed = parseChangelog(content)

  const existingEntry = parsed.versions.find((v) => v.version === version)

  if (existingEntry) {
    // Check if commits match (idempotency check)
    const expectedContent = generateVersionEntry(version, commits, date)
    if (existingEntry.content === expectedContent) {
      return { changed: false } // Already correct
    }
    // Update existing entry (edge case: commits amended)
    parsed.versions = parsed.versions.map((v) => (v.version === version ? { ...v, content: expectedContent } : v))
  } else {
    // Add new entry
    const newEntry = generateVersionEntry(version, commits, date)
    parsed.versions.unshift({ version, content: newEntry })
  }

  writeFileSync(changelogPath, stringifyChangelog(parsed))
  return { changed: true }
}
```

---

## Phase 2: Lefthook Post-Commit Hook

### 2.1 Hook Configuration

**File**: `lefthook.yml`

```yaml
post-commit:
  commands:
    version:
      run: node tools/scripts/post-commit-version.mjs
      # Only run if conventional commit in message
      # Skip if commit message starts with "chore(" (version commits)
```

### 2.2 Post-Commit Script

**File**: `tools/scripts/post-commit-version.mjs`

```javascript
#!/usr/bin/env node

import { execSync } from 'child_process'

// Skip if this is already a version commit
const lastCommitMsg = execSync('git log -1 --pretty=%B', { encoding: 'utf-8' })
if (lastCommitMsg.startsWith('chore(') && lastCommitMsg.includes('release version')) {
  console.log('Skipping version check for release commit')
  process.exit(0)
}

// Get affected projects
const affected = execSync('npx nx show projects --affected --base=HEAD~1', {
  encoding: 'utf-8',
})
  .trim()
  .split('\n')
  .filter(Boolean)

if (affected.length === 0) {
  console.log('No affected projects')
  process.exit(0)
}

// Filter to only library projects
const libs = affected.filter((p) => p.startsWith('lib-') || p === 'plugin-features')

if (libs.length === 0) {
  console.log('No library projects affected')
  process.exit(0)
}

console.log(`Checking versions for: ${libs.join(', ')}`)

// Run idempotent version check for each affected library
let hasChanges = false
for (const lib of libs) {
  const result = execSync(`npx nx version ${lib} --skipCommit --skipPush`, {
    encoding: 'utf-8',
    stdio: 'pipe',
  })

  if (result.includes('version updated')) {
    hasChanges = true
    console.log(`✓ ${lib}: version updated`)
  } else {
    console.log(`○ ${lib}: already versioned`)
  }
}

if (hasChanges) {
  // Stage the version changes
  execSync('git add libs/*/package.json libs/*/CHANGELOG.md plugins/*/package.json plugins/*/CHANGELOG.md', {
    stdio: 'inherit',
  })

  // Amend the commit to include version changes
  execSync('git commit --amend --no-edit', { stdio: 'inherit' })

  console.log('\n📦 Version changes included in commit')
}
```

### 2.3 Alternative: Pre-Push Hook

If amending commits is too invasive, use pre-push instead:

```yaml
pre-push:
  commands:
    version-check:
      run: node tools/scripts/pre-push-version-check.mjs
```

This would:

1. Check if affected libs have correct versions
2. If not, fail the push with instructions
3. Developer runs `npx nx affected -t=version` manually and commits

---

## Phase 3: PR Pipeline Integration

### 3.1 Version Validation Job

Add to `ci-pr.yml` after all checks pass:

```yaml
version-validation:
  name: version-validation
  runs-on: ubuntu-latest
  needs: [ci-status]
  if: needs.ci-status.result == 'success'
  permissions:
    contents: write
    pull-requests: write
  steps:
    - name: Checkout repository
      uses: actions/checkout@v4
      with:
        ref: ${{ github.head_ref }}
        fetch-depth: 0
        token: ${{ secrets.GITHUB_TOKEN }}

    - name: Setup monorepo
      uses: ./.github/actions/setup-monorepo

    - name: Configure Git
      run: |
        git config user.name "github-actions[bot]"
        git config user.email "github-actions[bot]@users.noreply.github.com"

    - name: Check version status
      id: version-check
      run: |
        # Get affected libraries
        AFFECTED=$(npx nx show projects --affected --base=origin/${{ github.base_ref }} --type=lib)

        if [ -z "$AFFECTED" ]; then
          echo "No libraries affected"
          echo "needs_update=false" >> $GITHUB_OUTPUT
          exit 0
        fi

        echo "Affected libraries: $AFFECTED"

        # Run version in check mode (outputs whether updates needed)
        NEEDS_UPDATE=false
        for lib in $AFFECTED; do
          RESULT=$(npx nx version $lib --check-only 2>&1) || true
          if echo "$RESULT" | grep -q "needs version update"; then
            NEEDS_UPDATE=true
            echo "  $lib: needs update"
          else
            echo "  $lib: up to date"
          fi
        done

        echo "needs_update=$NEEDS_UPDATE" >> $GITHUB_OUTPUT

    - name: Update versions (fallback)
      if: steps.version-check.outputs.needs_update == 'true'
      run: |
        npx nx affected -t=version \
          --base=origin/${{ github.base_ref }} \
          --skipPush

        # Check if there are changes to commit
        if git diff --staged --quiet; then
          echo "No version changes to commit"
        else
          git commit -m "chore: update versions and changelogs"
          git push origin HEAD:${{ github.head_ref }}
          echo "::notice::Version updates pushed to PR"
        fi
```

### 3.2 PR Comment Notification

```yaml
- name: Comment on PR
  if: steps.version-check.outputs.needs_update == 'true'
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: '📦 **Version Update**: CHANGELOGs and version numbers have been automatically updated for affected libraries.\n\nPlease pull the latest changes before pushing more commits.'
      })
```

---

## Phase 4: Release Pipeline (Publish Only)

### 4.1 New Release Workflow

**File**: `.github/workflows/ci-release.yml`

```yaml
name: release

on:
  pull_request:
    types: [closed]
    branches: [main]

jobs:
  publish:
    name: publish
    runs-on: ubuntu-latest
    # Only run on merged PRs, not closed without merge
    if: github.event.pull_request.merged == true
    permissions:
      contents: read
      id-token: write # For npm provenance
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup monorepo
        uses: ./.github/actions/setup-monorepo

      - name: Get affected libraries
        id: affected
        run: |
          AFFECTED=$(npx nx show projects --affected \
            --base=${{ github.event.pull_request.base.sha }} \
            --head=${{ github.event.pull_request.merge_commit_sha }} \
            --type=lib)

          if [ -z "$AFFECTED" ]; then
            echo "No libraries affected"
            echo "has_libs=false" >> $GITHUB_OUTPUT
          else
            echo "Affected libraries: $AFFECTED"
            echo "has_libs=true" >> $GITHUB_OUTPUT
          fi

      - name: Build affected libraries
        if: steps.affected.outputs.has_libs == 'true'
        run: |
          npx nx affected -t=build \
            --base=${{ github.event.pull_request.base.sha }} \
            --head=${{ github.event.pull_request.merge_commit_sha }}

      - name: Publish to npm (DRY RUN)
        if: steps.affected.outputs.has_libs == 'true'
        run: |
          npx nx affected -t=publish \
            --base=${{ github.event.pull_request.base.sha }} \
            --head=${{ github.event.pull_request.merge_commit_sha }} \
            --dryRun
        # env:
        #   NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      # Uncomment when ready for real publishing
      # - name: Publish to npm
      #   if: steps.affected.outputs.has_libs == 'true'
      #   run: |
      #     npx nx affected -t=publish \
      #       --base=${{ github.event.pull_request.base.sha }} \
      #       --head=${{ github.event.pull_request.merge_commit_sha }}
      #   env:
      #     NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Create GitHub Release
        if: steps.affected.outputs.has_libs == 'true'
        uses: actions/github-script@v7
        with:
          script: |
            // Get version tags created in this PR
            const { execSync } = require('child_process');
            const base = '${{ github.event.pull_request.base.sha }}';
            const head = '${{ github.event.pull_request.merge_commit_sha }}';

            // Find new tags in the merge
            const tags = execSync(`git tag --contains ${head} | grep '@'`, { encoding: 'utf-8' })
              .trim().split('\n').filter(Boolean);

            for (const tag of tags) {
              const [project, version] = tag.split('@');
              await github.rest.repos.createRelease({
                owner: context.repo.owner,
                repo: context.repo.repo,
                tag_name: tag,
                name: `${project} v${version}`,
                body: `Release ${project} version ${version}\n\nSee CHANGELOG.md for details.`,
                draft: false,
                prerelease: version.includes('-')
              });
            }
```

### 4.2 Remove Release From ci-main.yml

Remove the `release` job from `ci-main.yml` entirely. The main branch workflow should only validate, not release.

---

## Phase 5: Git Tag Management

### 5.1 Tag Creation Strategy

Tags are created during the version command (locally or in PR validation):

```typescript
// In version executor
function createVersionTag(projectName: string, version: string): void {
  const tag = `${projectName}@${version}`

  // Check if tag already exists
  const existingTags = execSync('git tag -l', { encoding: 'utf-8' })
  if (existingTags.includes(tag)) {
    console.log(`Tag ${tag} already exists`)
    return
  }

  // Create lightweight tag (not pushed until PR merge)
  execSync(`git tag ${tag}`)
}
```

### 5.2 Tag Push Strategy

Tags are pushed only after PR merge, in the release workflow:

```yaml
- name: Push version tags
  run: |
    # Push all tags that match our pattern
    git push origin --tags
```

---

## Implementation Order

### Week 1: Foundation

1. [ ] Create custom version executor with idempotent logic
2. [ ] Implement version calculator (commit analysis)
3. [ ] Implement CHANGELOG updater (idempotent)
4. [ ] Add unit tests for version executor

### Week 2: Local Integration

5. [ ] Create post-commit script
6. [ ] Update lefthook.yml configuration
7. [ ] Test local workflow end-to-end
8. [ ] Document local development workflow

### Week 3: CI Integration

9. [ ] Add version-validation job to ci-pr.yml
10. [ ] Create ci-release.yml (publish-only)
11. [ ] Remove release job from ci-main.yml
12. [ ] Test PR workflow end-to-end

### Week 4: Polish

13. [ ] Add PR comment notifications
14. [ ] Add GitHub Release creation
15. [ ] Update documentation
16. [ ] Remove .github/test-events/ (optional)

---

## Risks and Mitigations

| Risk                                 | Mitigation                                      |
| ------------------------------------ | ----------------------------------------------- |
| Post-commit hook slows down commits  | Make it fast (<2s), skip non-lib changes        |
| Amending commits confuses developers | Use pre-push instead, or document behavior      |
| PR validation commits create noise   | Single "update versions" commit, clear message  |
| Tag conflicts                        | Idempotent tag creation, check before create    |
| Concurrent PRs with same lib changes | Version calculation based on tags, not branches |

---

## Success Criteria

- [ ] Local commits automatically include version updates
- [ ] PRs show complete CHANGELOG diffs
- [ ] No CI recursion possible (publish workflow has no write permissions to code)
- [ ] Running version command twice produces identical result
- [ ] Merging PR immediately publishes to npm (when enabled)

---

## Related Documents

- [BUILD_SYSTEM_PROGRESS.md](./BUILD_SYSTEM_PROGRESS.md) — Build architecture
- [DEPLOYMENT_PUBLISHING.md](./DEPLOYMENT_PUBLISHING.md) — Publishing workflow
- [BUILD_SYSTEM_TODO.md](./BUILD_SYSTEM_TODO.md) — Build tasks
