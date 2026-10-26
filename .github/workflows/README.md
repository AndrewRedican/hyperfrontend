# GitHub Actions Workflows

This directory contains the CI/CD workflows for the hyperfrontend monorepo.

## Active Workflows

### CI - Pull Request ([ci-pr.yml](./ci-pr.yml))

**Trigger**: Pull requests to `main` branch
**Purpose**: Run exactly the tasks the change reaches, planned by the owned workspace graph

**How it works**:

1. The `plan` job builds and verifies the persisted graph state, checks the formatting of every file, and runs `pipeline plan`: the owned selection of `typecheck`, `lint`, `test`, `build` and `e2e` from the merge base, folded into **chains** (one project on one environment, its tasks and the prerequisites between them), ranked heaviest first. The plan is uploaded as `pipeline-plan`, summarised on the run page with a reason per task and per skip, and sets the `environments` matrix.
2. `version-check` validates the version bumps of the libraries the change reaches, and gates the environments.
3. One `environment (linux)` job and, when any library or tool is selected, one `environment (windows)` job download the plan and run `pipeline run`: a scheduler starts every task whose prerequisites succeeded, as many at once as the runner affords (light tasks up to the CPU count, library builds two at a time), skips the dependents of a failure and keeps everything independent running. Each task is `npx nx run <project>:<target>` (the floor probe and the linter consumer smoke run their scripts on the Node.js release they are meant for); its output is replayed as one folded block when it ends. Linux chains carry build, e2e, probe and smoke; Windows chains carry typecheck, lint and test of the libraries and tools, plus the linter build and smoke, and compare the graph-state digest with Linux.
4. Every chain is a check run on the pull request (`lib-features (linux)`), and each environment's summary carries a task table and a Mermaid timeline; `pipeline-results-<os>` holds the results and the per-task logs.
5. `status` aggregates `binary-budget`, `plan`, `version-check` and the environments, and passes when the plan finds nothing to run.

**Features**:

- Cancels in-progress runs when new commits are pushed
- Read-only permissions by default; the environments add `checks: write` for the chain check runs
- `PIPELINE_NX_TARGETS` in the `plan` step names targets Nx selects instead of the owned graph: the per-target rollback knob, empty by default
- Uploads build artifacts and coverage for reuse

**Jobs**:

- `plan`: Graph state, format check, the plan and the matrix
- `graph-advisory`: Compares the owned affected analysis with Nx's task-level selection for the pull request and uploads the report; advisory, never gating
- `binary-budget`: The binary budget of the pull request, whether or not any task runs
- `version-check`: Validates version bumps were applied locally
- `environment (linux)`, `environment (windows)`: Run the plan
- `status`: Aggregates results and provides final status

### CI - Main Branch ([ci-main.yml](./ci-main.yml))

**Trigger**: Pushes to `main` branch, and `workflow_dispatch` with `full` to run every task of every project
**Purpose**: The same plan as a pull request, from the previous head of `main`, plus publishing

**How it works**:

1. `plan` selects from `github.event.before` to the pushed head (a force-push, a first push or a dispatch without one plans everything), adds a `publish` task after every selected build of a publishable library, and adds a whole chain for any publishable library whose current version npm positively reports absent (registry drift), so a publish that failed on an earlier push is retried.
2. The environments run as on a pull request. Before the first publish, the Linux scheduler waits for `environment (windows)` to conclude through the jobs API; a Windows failure or a 20-minute timeout skips every publish and fails the job. Publishes run in dependency order (the publish of a package a library bundles or pins as a peer first), each still `npx nx run <lib>:publish`, whose executor skips a version already on npm.
3. Codecov uploads, the `dist` artifact and the results come from the Linux environment.
4. `push-tags`, `github-release` and `dispatch-native-builds` follow a green environment matrix as before.

**Features**:

- Does not cancel in-progress runs (safer for main branch)
- Longer retention for the plan, the results and coverage (30 days)
- Automated npm publishing, GitHub releases and native binary dispatch

**Jobs**:

- `plan`: Graph state, format check, the plan with publishes and registry drift
- `environment (linux)`, `environment (windows)`: Run the plan; the Linux one publishes
- `status`: Aggregates results and provides final status
- `push-tags`: Creates and pushes version tags
- `create-github-release`: Creates GitHub releases with changelog
- `dispatch-native-builds`: Dispatches the native binary workflows for new tags

### Individual Library CI (ci-lib-\*.yml)

**Trigger**: `workflow_run` - fires after `ci-main.yml` completes
**Purpose**: Per-project build badges WITHOUT redundant builds

**How it works**:

1. `ci-main.yml` runs the plan and uploads `pipeline-results-linux`
2. When it completes, individual `ci-lib-*.yml` workflows trigger via `workflow_run`
3. Each individual workflow uses `_lib-status.yml` template to read the library's chain outcome from the results of the newest runs
4. No building happens - just status reporting for badges

### Library Status Reporter ([\_lib-status.yml](./_lib-status.yml))

**Trigger**: Called by `ci-lib-*.yml` workflows via `workflow_call`
**Purpose**: Reusable template to report a library's chain outcome from the main run's results

**Inputs**:

- `project-name`: Nx project name (e.g., lib-nexus)
- `library-path`: Path to library (e.g., libs/nexus)

**Jobs**:

- `check-status`: Downloads `pipeline-results-linux` from the newest completed `ci` runs on `main` and reports the project's chain outcome, walking back while the project had no chain

### Downloads Freshness ([downloads-freshness.yml](./downloads-freshness.yml))

**Trigger**:

- Daily schedule (13:20 UTC)
- Manual dispatch

**Purpose**: Keep the documentation site's npm download statistics current without committing data

**How it works**:

1. Reads `/docs/downloads/snapshot.json` from the published site, which states the newest npm day the site was built with
2. Asks npm which day it has most recently counted
3. When npm is ahead, posts to the Vercel deploy hook in the `VERCEL_DEPLOY_HOOK_URL` secret; the production build fetches the missing days itself (`apps/docs-site/README.md`, Deployment)
4. When the two agree, ends without building or deploying anything

**Features**:

- No install: a dependency-free Node script makes the two requests
- Read-only repository permissions; no commits, so no workflow or deployment loop
- Fails loudly when the site or npm cannot be reached, or when the hook secret is missing on the day it is needed

**Jobs**:

- `freshness`: Compares the published frontier with npm's and triggers a production build only when they differ

### Graph Advisory ([graph-advisory.yml](./graph-advisory.yml))

**Trigger**:

- Weekly schedule (Monday 05:30 UTC)
- Manual dispatch, with the number of merges and commits to replay

**Purpose**: Keep the evidence that the owned affected analysis skips nothing Nx would run, before the pipeline trusts it

**How it works**:

1. Builds the persisted graph state cold and verifies it
2. Replays the newest merges on `main`, and its newest commits one by one, capturing Nx's task-level selection for each range in a worktree sharing the installed `node_modules`; a revision whose `nx.json` names a plugin no longer installed is reported and skipped
3. Runs the owned analysis at each replayed head and classifies every difference: (a) narrower with a named rule for every file Nx cites, (b) wider, (c) narrower without such a rule
4. Writes the report to the job summary and uploads it with the captures
5. The `full-run` job dispatches `ci-main.yml` with `full: true`, so every task of every project runs once a week: the net under the narrower pull-request and main plans

**Features**:

- Advisory: the job reports, nothing reads its result
- Read-only repository permissions

**Jobs**:

- `compare`: Replays, compares and uploads `graph-advisory-report`
- `full-run`: Dispatches the weekly full run of `ci-main.yml`

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

**Note**: Node.js version comes from `.nvmrc`, the one pin every environment reads.

### version-check

Validates the version bumps of the libraries a change reaches, selected through the owned graph, and keeps one comment on the pull request.

The selection and execution of work are not actions: `tools/workspace/bin/pipeline.ts` plans and runs, and the workflow files hold only what GitHub itself must read. See [`tools/workspace/README.md`](../../tools/workspace/README.md).

## Security Features

### Pinned Action Versions

All third-party actions are pinned to specific commit SHAs for security:

- `actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd` (v6.0.2)
- `actions/setup-node@6044e13b5dc448c55e2357c09f80417699197238` (v6.2.0)
- `actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02` (v4.6.2)
- `actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093` (v4.3.0)
- `actions/cache@cdf6c1fa76f9f475f3d7449005a359c84ca0f306` (v5.0.3)
- `codecov/codecov-action@671740ac38dd9b0130fbe1cec585b89eea48d3de` (v5.5.2)
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

- The owned plan runs only the tasks a change reaches, with a reason per task and per skip
- The scheduler runs independent tasks concurrently inside each environment and skips the dependents of a failure
- npm dependency caching and the Nx cache, keyed per job family

## Troubleshooting

### Workflow Not Triggering

- Check branch protection rules require the correct status check name
- Verify workflow trigger conditions match your branch/event
- Check workflow file syntax with `act --list`

### Cache Not Working

- Clear the cache: Go to Actions → Caches → Delete cache
- Verify `package-lock.json` hasn't changed unexpectedly
- Check cache key generation in workflow logs

### Plan Issues

- Ensure `fetch-depth: 0` is set in checkout step
- Read the `plan` job summary: every task lists the reason it runs, every skipped task the rule that made the skip safe
- Set `PIPELINE_NX_TARGETS` to a target name to let Nx select that target while the owned selection is investigated

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

## Repository Configuration

### Required Branch Protection Rules

The following branch protection rules should be configured for the `main` branch:

**Settings → Branches → Branch protection rules → Add rule**

| Setting                                      | Value          |
| -------------------------------------------- | -------------- |
| Branch name pattern                          | `main`         |
| Require a pull request before merging        | ✅ Enabled     |
| Require status checks to pass before merging | ✅ Enabled     |
| Required status checks                       | See list below |
| Require branches to be up to date            | ✅ Enabled     |

**Required Status Checks**:

1. **From `ci-pr.yml`**:
   - `status` (ci-status job)

2. **From `security-scan.yml`**:
   - `code analysis` (CodeQL analysis)
   - `dependency audit` (npm vulnerability scan)

**Why CodeQL as a required check?**

The `security-scan.yml` workflow runs CodeQL analysis in parallel with the PR workflow. GitHub Actions does not support cross-workflow dependencies, so we enforce CodeQL completion via branch protection rules instead of workflow conditions.

**Important Notes**:

- The `version-check` job runs after the plan and gates the environments (validation only, no commits)
- Version bumps are applied locally via lefthook pre-push hooks
- CI validates that expected versions match committed versions
- Uses GITHUB_TOKEN with read-only contents permission

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
