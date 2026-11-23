# Contributing to hyperfrontend

Thank you for your interest in contributing to hyperfrontend! We appreciate your time and effort in making this project better.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributor License Agreement (CLA)](#contributor-license-agreement-cla)
- [Making Changes](#making-changes)
  - [Building Libraries](#building-libraries)
  - [Versioning](#versioning-automatic)
  - [Publishing](#publishing-maintainers)
- [AI Assistance Disclosure](#ai-assistance-disclosure)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Coding Standards](#coding-standards)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Questions](#questions)

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it to understand the standards we uphold for a respectful and inclusive community.

## Getting Started

Before you begin contributing, please:

1. Check the [issue tracker](https://github.com/AndrewRedican/hyperfrontend/issues) for existing issues or feature requests
2. Review the [README](README.md) to understand the project's purpose and architecture
3. Read this contributing guide in full
4. Review [REGARDING_AI.md](REGARDING_AI.md): AI assistance disclosure in pull requests is mandatory

## Development Setup

### Prerequisites

- Node.js (v24.18.0 or later)
- npm (v10.0.0 or later)
- Git
- GitHub account

### Recommended Setup (GitHub Codespaces)

The **easiest way** to contribute is using GitHub Codespaces, which provides a fully configured development environment:

1. **Fork the repository** to your GitHub account
2. **Open in Codespaces**:
   - Navigate to your forked repository on GitHub
   - Click the green "Code" button
   - Select the "Codespaces" tab
   - Click "Create codespace on main" (or your working branch)

The devcontainer will automatically:

- Install all required dependencies
- Configure the development environment
- Run the postinstall script
- Set up all necessary tools and extensions

**That's it!** You're ready to start contributing.

### Alternative Setup (Local Development)

If you prefer to work locally:

1. **Fork the repository** on GitHub

2. **Clone your fork**:

   ```bash
   git clone https://github.com/YOUR_USERNAME/hyperfrontend.git
   cd hyperfrontend
   ```

3. **Add upstream remote**:

   ```bash
   git remote add upstream https://github.com/AndrewRedican/hyperfrontend.git
   ```

4. **Install dependencies**:

   ```bash
   npm install
   ```

The `postinstall` script will automatically run and apply any necessary patches via `patch-package`.

#### Devcontainer Setup

If you want to use the devcontainer locally with VS Code:

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop)
2. Install the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) for VS Code
3. Open the project in VS Code
4. When prompted, click "Reopen in Container" or run the command: **Dev Containers: Reopen in Container**

The devcontainer configuration is located in `.devcontainer/devcontainer.json` and will set up:

- Node.js environment
- Required system dependencies
- VS Code extensions
- Git configuration
- Development tools (Prettier, the workspace linter and the `hf` command line, etc.)

### Verify Your Setup

After setup, verify everything works. Every workspace task runs through the workspace's own command line, `npx hf <command>`, from the repository root:

```bash
# Build all packages
npx hf run-many -t build --all

# Run tests
npx hf run-many -t test --all

# Lint code
npx hf run-many -t lint --all
```

`run <project>:<target>` runs one task alone; `run-many` runs the named tasks and their `dependsOn` prerequisites, one at a time, and skips the dependents of a failure. Nothing is cached, so every task runs every time.

`run-many` and `affected` show a run as it goes: one line per task as it ends, the excerpt of a failed task's log, and a matrix of projects by targets at the end. Each task writes its whole output to `.hf/logs/<project>__<target>.log`. Pass `--stream` to have the tasks write straight to the terminal instead, which a target that keeps running (a server) or asks for input needs. Each `-t` is a stage: `-t typecheck,lint -t test -t build` runs the type checks and lints to the end, and starts the tests only when all of them passed.

### Working with Documentation

The documentation site is a Next.js application located in `apps/docs-site/`.

#### Running Documentation Locally

```bash
# Install dependencies (required once)
npx hf run docs-site:install

# Build the site and serve it
npx hf run-many -t serve -p docs-site --stream
```

The site will be available at `http://localhost:3000`.

#### Building Documentation

```bash
npx hf run-many -t build -p docs-site
```

The output will be in `apps/docs-site/out/` (this directory is gitignored).

#### Documentation Structure

See the [Documentation Roadmap](./roadmap/docs-site-action-plan.md) for the full documentation plan and structure.

## Contributor License Agreement (CLA)

**IMPORTANT**: Before your pull request can be merged, you must sign a Contributor License Agreement (CLA).

### Why a CLA?

The CLA protects both you and the project maintainer by:

- Ensuring you have the right to contribute the code
- Granting the project maintainer the necessary rights to use, modify, and distribute your contributions
- Protecting the project's ability to change licenses in the future if needed
- Providing legal clarity for all parties involved

### CLA Terms

By signing the CLA, you agree that:

1. You grant **Andrew Redican** (the project maintainer and author) **exclusive rights** to your contributions
2. You grant perpetual, worldwide, non-exclusive, royalty-free license for your contributions
3. You confirm that you have the legal right to make the contribution
4. Your contributions are provided "as-is" without warranties
5. The project maintainer retains **sole decision-making authority** over the project, including:
   - Accepting or rejecting contributions
   - Code review and merge decisions
   - Project direction and roadmap
   - License changes
   - Release schedules and versioning

### How to Sign the CLA

We use [CLA Assistant](https://cla-assistant.io/) to manage our CLA process:

1. **Automatic Prompt**: When you open your first pull request, the CLA Assistant bot will automatically comment on your PR
2. **Review and Sign**: Click the link provided by the bot to review and sign the CLA
3. **Sign with GitHub**: Authenticate with your GitHub account to electronically sign
4. **Confirmation**: Once signed, the bot will update your PR status

Your signature is stored securely and applies to all future contributions to this project.

### Re-signing

You only need to sign the CLA once. However, you may need to re-sign if:

- The CLA terms are updated
- You contribute from a different GitHub account

## Making Changes

### Branch Naming

Create a descriptive branch name:

- `feature/your-feature-name` - for new features
- `fix/bug-description` - for bug fixes
- `docs/documentation-update` - for documentation changes
- `chore/maintenance-task` - for maintenance tasks

Example:

```bash
git checkout -b feature/add-vue-support
```

### Keep Your Fork Updated

Regularly sync your fork with the upstream repository:

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

### Making Your Changes

1. Make your changes in your feature branch
2. Write or update tests as needed
3. Ensure all tests pass
4. Update documentation if necessary
5. Add entries to relevant CHANGELOG files if applicable

### Testing Your Changes

Rehearse a push without pushing. This runs every step of the pre-push hook, in order, and stops at the first that fails:

```bash
npx hf hooks run pre-push

# Only the pipeline step: typecheck and lint, then tests, then build and e2e of what your change reaches
npx hf hooks run pre-push --only=pipeline
```

The pipeline is the one the pre-push hook and CI run, from the merge base with `origin/main` to your working tree. It can also be started and planned on its own:

```bash
# Typecheck, lint, test, build and e2e of what your change reaches, in three stages, with a reason per task;
# a task the last run here proved, and whose inputs have not changed since, is counted as inherited and not started
node --import ./libs/workspace/src/hooks/index.ts tools/pipeline/bin/pipeline.ts run --local

# The same, running every task again whatever the last run proved
node --import ./libs/workspace/src/hooks/index.ts tools/pipeline/bin/pipeline.ts run --local --no-inherit

# Only plan: which chains and tasks a change reaches, and why every other task is skipped
node --import ./libs/workspace/src/hooks/index.ts tools/pipeline/bin/pipeline.ts plan --base origin/main
```

One task of one project runs alone, without the tasks it depends on, through the workspace's own entry:

```bash
npx hf run lib-nexus:test
```

A target across every project a change reaches, from the merge base with `origin/main` unless `--base` names another revision:

```bash
npx hf affected -t test
npx hf affected -t lint
npx hf affected -t build --base=main
CI=1 npx hf affected -t e2e
```

E2E tests validate that built packages work correctly when consumed via `npm install`. Test projects in `apps/package-e2e/` manage their own dependencies separately from the root workspace.

### Building Libraries

Build a single library or all libraries:

```bash
# Build one library
npx hf run lib-nexus:build

# Build all libraries
npx hf run-many -t build -p 'lib-*'
```

Output goes to `dist/libs/<library>/` with ESM + CJS formats.

### Versioning (Automatic)

Version bumps are made by `npx hf push`, which bumps, commits and pushes in one go:

```bash
npx hf push                                # or, the first time: npx hf push --set-upstream origin my-branch
```

1. The `version:all` target detects the libraries your commits release
2. For each of them, versioning runs (package.json, CHANGELOG.md updated)
3. A single batch commit is created: `chore: update versions for lib-a, lib-b`
4. `git push` runs with the arguments you gave, and carries your changes and the version commit
5. The pre-push hook then checks what is being pushed: the binary budget, the dependency audit, the versions, and the pipeline

A plain `git push` still works whenever no bump is due. When one is due, the pre-push hook refuses the push and tells you to use `npx hf push`. A commit made inside a pre-push hook is not part of the push in flight, which is why the bump happens before the push and the hook only checks.

**What this means for you:**

- Just write conventional commit messages (`feat:`, `fix:`, `security:`, `docs:`, etc.)
- Push with `npx hf push`; versioning happens as part of it
- Your PR will include the version bump already applied
- A push can bump libraries your branch did not edit: one that ships a copy of code you changed is released by a patch, and a releasable change to the modules of the builder that shape a tarball (the `toolchain` named input in `hf.json`) or to the package build executor releases every library. That named input is a hand-kept list, and the root lint (`npx hf run hyperfrontend:lint`) holds it to the builder's sources: it fails until a new builder module is either listed in the input, when it changes what lands in a tarball, or named outside it in the root `lint.config.ts`

**If you need to bypass the hook (not recommended):**

```bash
# CI fails with remediation instructions when a due bump is missing
git push --no-verify
```

**To manually version (rarely needed):**

```bash
# Preview batch version changes (dry run)
npx hf run hyperfrontend:version:all --dryRun

# Preview single library version changes
npx hf run lib-nexus:version --dryRun

# Manually run versioning for a single library
npx hf run lib-nexus:version

# Validate version state (what CI runs)
npx hf run lib-nexus:version-check
```

**CI Validation:**

CI runs `version-check` to validate that versions were correctly applied. It never bumps. If you pushed with `--no-verify` (bypassing the pre-push hook) while a bump was due, CI will fail and comment on your PR with instructions to fix.

### Publishing (Maintainers)

Publishing happens via CI after PR merge. To test locally:

```bash
# Dry run (preview); the build runs first, and --stream shows the preview in the terminal
npx hf run-many -t publish -p lib-nexus --dryRun --stream

# Publish to local Verdaccio for testing
npx hf run-many -t publish -p lib-nexus \
  --registry=http://localhost:4873
```

## AI Assistance Disclosure

If any part of your pull request was produced with AI assistance (code, tests, documentation, or commit messages), you must say so in the PR description. This is not optional, and it is not a judgment. It is information the maintainer needs.

When a bug needs tracing or a contribution needs closer examination, it matters whether the code reflects your personal understanding or was generated by an LLM. Those come with different assumptions about how much context you have, and the level of review applied will reflect that. Trust between contributors and the maintainer builds over time, and accurate disclosure is part of how that works.

Admitting you used AI heavily and are not certain about every detail is fine. Say it plainly. That kind of honesty is received well. What is not acceptable is presenting AI-generated work as the product of your own expertise when it is not. That misrepresents both the contribution and yourself.

The PR template has a required section for this. Fill it in honestly.

## Submitting a Pull Request

### Before Submitting

- [ ] All tests pass
- [ ] Code follows the project's coding standards
- [ ] Commit messages follow the conventional commit format
- [ ] Documentation is updated (if applicable)
- [ ] No merge conflicts with the main branch
- [ ] CLA is signed
- [ ] AI assistance is disclosed in the PR description (required if any AI tooling was used)

### Creating the Pull Request

1. **Push your changes** to your fork:

   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a Pull Request** on GitHub:
   - Navigate to the original repository
   - Click "New Pull Request"
   - Select your fork and branch
   - Fill out the PR template with:
     - Clear description of changes
     - Related issue numbers (if applicable)
     - Screenshots or examples (if applicable)
     - Testing steps

3. **Sign the CLA** when prompted by the CLA Assistant bot

4. **Wait for review**: The maintainer will review your PR and may request changes

### PR Review Process

- The maintainer has **sole authority** to approve or reject pull requests
- Code reviews may take several days depending on complexity
- Be responsive to feedback and requested changes
- Keep discussions professional and constructive
- The maintainer's decision is final

## Continuous Integration

### GitHub Actions Workflows

The project uses GitHub Actions for CI/CD automation. All pull requests must pass CI checks before merging.

#### PR Validation Workflow

When you open a pull request:

- **Fast Checks**: Only affected projects are validated (format, lint, build, test)
- **Version Check**: Validates that the version bumps your commits call for were applied by `npx hf push`
- **Inherited outcomes**: A later push runs only the tasks its change since the previous run reaches. The others keep that run's success and show as `inherited`. The label `pipeline-run-all` (from the next push) or "Re-run all jobs" (at once) proves everything the pull request reaches again
- **Typical Duration**: < 10 minutes
- **Status Check**: "status" must pass to merge

If the version-check fails, CI will comment on your PR with instructions to fix.

#### Main Branch Workflow

After merging to `main`:

- **Coverage Thresholds**: Enforces code coverage requirements
- **Typical Duration**: < 15 minutes
- **Artifacts**: Coverage reports retained for 30 days

#### Security Scanning

Runs automatically on:

- All pull requests
- Pushes to main
- Weekly schedule (Mondays)

Includes:

- CodeQL static analysis
- npm dependency vulnerability scanning
- Fails on high/critical vulnerabilities

### Testing Workflows Locally

You can test workflows locally using [act](https://github.com/nektos/act):

```bash
# Install act
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash  # Linux

# Test PR workflow
act pull_request -W .github/workflows/ci-pr.yml

# Test specific job
act pull_request -j plan -W .github/workflows/ci-pr.yml

# Test with event payload
act pull_request -W .github/workflows/ci-pr.yml -e .github/test-events/pr-opened.json
```

For detailed testing instructions, see [`.github/test-events/README.md`](.github/test-events/README.md).

### Understanding CI Failures

If your PR fails CI checks:

1. **Review the logs**: Click "Details" next to the failed check
2. **Identify the issue**: Look for error messages in the job output
3. **Test locally**: Run the same commands locally to reproduce
4. **Fix and push**: Commit your fixes and push (workflow runs automatically)

Common CI failures and fixes:

```bash
# Format check failed
npx hf format --write

# Lint check failed
npx hf affected -t lint

# Test check failed
npx hf affected -t test

# Build check failed
npx hf affected -t build
```

### Workflow Documentation

For more details about workflows and custom actions:

- Workflow overview: [`.github/workflows/README.md`](.github/workflows/README.md)
- Custom actions: [`.github/actions/README.md`](.github/actions/README.md)

## Coding Standards

### TypeScript/JavaScript

- Follow the existing code style
- Use TypeScript for type safety
- Write clear, self-documenting code
- Add JSDoc comments for public APIs
- Keep functions small and focused

### Linting

The project lints with the workspace linter, `@hyperfrontend/linter`:

```bash
# Lint every project
npx hf run-many -t lint --all

# Fix auto-fixable issues in one project
npx hf run lib-nexus:lint --fix
```

### Formatting

Prettier owns formatting. `npx hf format --check` checks the files your change touches, `--write` rewrites them, and `--all` covers the whole workspace.

## Commit Message Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/), authored and validated by the `cz` / `cl` bins shipped in [`@hyperfrontend/versioning`](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/versioning). Configuration lives in the workspace-root [`commit.config.js`](https://github.com/AndrewRedican/hyperfrontend/blob/main/commit.config.js).

### Commit Message Format

```text
<type>(<scope>): <subject>

<body>

<footer>
```

### Authoring a commit

Stage your changes with `git add`, then run one of:

```bash
npm run commit   # equivalent
npx cz           # same bin
```

This walks you through `type → scope → subject → body → breaking → issues → preview`, then runs `git commit` with the formatted message. Cancel at any step with `Ctrl-C`.

### Commit Types

- **feat**: A new feature
- **fix**: A bug fix
- **security**: A dependency or code change made for a security reason
- **docs**: Documentation changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **build**: Build system changes
- **ci**: CI/CD changes
- **chore**: Other changes that don't modify src or test files

`feat`, `fix`, `security`, `perf` and `revert` release the library they are scoped to; the other types release nothing.

A dependency change made for a security reason is `security(<project>)`, whatever the size of the bump. It releases the package by a patch and is listed under "Security" in its changelog. It carries `!` when it breaks public API, and a change that adds public API is a `feat`. Bumping a dependency a package inlines, even across its major, breaks nothing for consumers; raising a real dependency or a peer range can.

### Examples

```bash
feat(plugin-features): add Vue.js support

Add generator and executor support for Vue.js framework in the features plugin.

Closes #123
```

```bash
fix(lib-nexus): resolve memory leak in event listeners

Ensure event listeners are properly cleaned up when features are destroyed.

Fixes #456
```

### Commit Hooks

The Git hooks are the workspace's own. Their steps are in [`hooks.config.ts`](https://github.com/AndrewRedican/hyperfrontend/blob/main/hooks.config.ts) at the repository root, and `npm install` installs them into your clone through the root `prepare` script (`npx hf generate hooks` does the same by hand).

- **pre-commit**: checks the binary budget of the staged files, and runs `hf format --write`, staging again the files it fixed
- **commit-msg**: validates the commit message with `cl`
- **pre-push**: checks the binary budget of the branch, audits the dependencies, checks that the version bumps your commits call for are in place, and runs the pipeline

Each hook runs its steps in order, stops at the first that fails, and ends on a list of the steps with how each ended. `npx hf hooks run <hook>` runs a hook by hand; `--only` and `--skip` select steps by name.

**The pipeline step is on for every clone.** It runs the same typecheck, lint, test, build and e2e tasks CI plans for your change, in three stages, so a pull request that would fail is known before it is raised. It covers your operating system only; the pull request still runs Linux, Windows and macOS.

**A second push does not repeat the first.** The step remembers what its last run on your machine proved and on which files (`.hf/pipeline/results-<os>.json`). A task whose inputs have not changed since keeps that success: the run counts it on one line as inherited and starts only the tasks your newer changes reach, plus any task that did not succeed last time. Nothing is restored from a cache; an inherited task simply does not run. A success older than seven days, or one from another Node.js release, is not inherited. To run everything your branch reaches again, push with `HF_PIPELINE_INHERIT=0 git push`, or start the pipeline by hand with `--no-inherit`.

A clone opts out of a step in an untracked `hooks.local.config.ts` beside the configuration:

```ts
import { defineLocalHooks } from '@hyperfrontend/workspace/git-hooks'

export default defineLocalHooks({ skip: ['pipeline'] })
```

For one push, `HF_HOOKS_SKIP=pipeline git push` does the same, and `HF_HOOKS=0` skips every step. A skipped step is always listed as skipped, with what skipped it.

## Questions

If you have questions about contributing:

1. Check the [README](README.md) and existing documentation
2. Search [existing issues](https://github.com/AndrewRedican/hyperfrontend/issues)
3. Open a [new issue](https://github.com/AndrewRedican/hyperfrontend/issues/new) with the "question" label

## License

By contributing to hyperfrontend, you agree that your contributions will be licensed under the project's license as specified in the [LICENSE.md](LICENSE.md) file, and you grant the project maintainer the rights specified in the CLA.

---

**Thank you for contributing to hyperfrontend! Your efforts help make this project better for everyone.** 🚀
