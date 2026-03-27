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

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

Before you begin contributing, please:

1. Check the [issue tracker](https://github.com/AndrewRedican/hyperfrontend/issues) for existing issues or feature requests
2. Review the [README](README.md) to understand the project's purpose and architecture
3. Read this contributing guide in full
4. Review [REGARDING_AI.md](REGARDING_AI.md) — AI assistance disclosure in pull requests is mandatory

## Development Setup

### Prerequisites

- Node.js (v24.13.0 or later)
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
- Development tools (Nx, ESLint, Prettier, etc.)

### Verify Your Setup

After setup, verify everything works:

```bash
# Build all packages
npx nx run-many -t build

# Run tests
npx nx run-many -t test

# Lint code
npx nx run-many -t lint
```

### Working with Documentation

The documentation site is a Next.js application located in `apps/docs-site/`.

#### Running Documentation Locally

```bash
# Install dependencies (required once)
npx nx install docs-site

# Start development server
npx nx serve docs-site
```

The site will be available at `http://localhost:3000`.

#### Building Documentation

```bash
npx nx build docs-site
```

The output will be in `apps/docs-site/out/` (this directory is gitignored).

#### Documentation Structure

See the [Documentation Roadmap](./roadmap/documentation-roadmap.md) for the full documentation plan and structure.

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

Run the following commands to ensure your changes don't break anything:

```bash
# Run tests for affected projects
npx nx affected -t test

# Run linting
npx nx affected -t lint

# Build affected projects
npx nx affected -t build

# Run E2E tests for affected libraries (verifies CJS, ESM, browser outputs)
CI=1 npx nx affected -t e2e
```

E2E tests validate that built packages work correctly when consumed via `npm install`. Test projects in `apps/package-e2e/` manage their own dependencies separately from the root workspace.

### Building Libraries

Build a single library or all libraries:

```bash
# Build one library
npx nx build lib-nexus

# Build all libraries
npx nx run-many -t build

# Skip cache for clean build
npx nx build lib-nexus --skip-nx-cache
```

Output goes to `dist/libs/<library>/` with ESM + CJS formats.

### Versioning (Automatic)

Version bumps happen automatically via **lefthook pre-push hooks**. When you `git push`:

1. lefthook runs typecheck, lint, and tests
2. The `version:all` target detects affected libraries
3. For each affected library, versioning runs (package.json, CHANGELOG.md updated)
4. A single batch commit is created: `chore: update versions for lib-a, lib-b`
5. Push proceeds with both your changes and the version commit

**What this means for you:**

- Just write conventional commit messages (`feat:`, `fix:`, `docs:`, etc.)
- Push normally — versioning happens automatically
- Your PR will include the version bump already applied

**If you need to bypass versioning (not recommended):**

```bash
# This will cause CI to fail with remediation instructions
git push --no-verify
```

**To manually version (rarely needed):**

```bash
# Preview batch version changes (dry run)
npx nx version:all --dryRun

# Preview single library version changes
npx nx version lib-nexus --dryRun

# Manually run versioning for a single library
npx nx version lib-nexus

# Validate version state (what CI runs)
npx nx version-check lib-nexus
```

**CI Validation:**

CI runs `version-check` to validate that versions were correctly applied. If you pushed with `--no-verify` (bypassing lefthook), CI will fail and comment on your PR with instructions to fix.

### Publishing (Maintainers)

Publishing happens via CI after PR merge. To test locally:

```bash
# Dry run (preview)
npx nx publish lib-nexus --dryRun

# Publish to local Verdaccio for testing
npx nx publish lib-nexus --registry=http://localhost:4873
```

## AI Assistance Disclosure

If any part of your pull request was produced with AI assistance — code, tests, documentation, or commit messages — you must say so in the PR description. This is not optional, and it is not a judgment. It is information the maintainer needs.

When a bug needs tracing or a contribution needs closer examination, it matters whether the code reflects your personal understanding or was generated by an LLM. Those come with different assumptions about how much context you have, and the level of review applied will reflect that. Trust between contributors and the maintainer builds over time, and accurate disclosure is part of how that works.

Admitting you used AI heavily and are not certain about every detail is fine. Say it plainly. That kind of honesty is received well. What is not acceptable is presenting AI-generated work as the product of your own expertise when it is not — that misrepresents both the contribution and yourself.

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

- **Affected Projects**: Nx calculates which projects are affected by your changes
- **Fast Checks**: Only affected projects are validated (format, lint, build, test)
- **Version Check**: Validates that version bumps were applied by lefthook
- **Typical Duration**: < 10 minutes
- **Status Check**: "CI Status Check" must pass to merge

If the version-check fails, CI will comment on your PR with instructions to fix.

#### Main Branch Workflow

After merging to `main`:

- **All Projects**: Comprehensive validation of the entire monorepo
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
act pull_request -j lint -W .github/workflows/ci-pr.yml

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
npx prettier --write "**/*.{ts,tsx,js,jsx,json,md,yml,yaml}"

# Lint check failed
npx nx run-many -t lint --fix

# Test check failed
npx nx run-many -t test

# Build check failed
npx nx run-many -t build
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

The project uses ESLint for code quality:

```bash
# Run ESLint
npx nx run-many -t lint

# Fix auto-fixable issues
npx nx run-many -t lint --fix
```

### Formatting

Code formatting is enforced through ESLint configuration. The project follows consistent formatting rules.

## Commit Message Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) with Commitizen to enforce consistent commit messages.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Using Commitizen

Instead of `git commit`, use:

```bash
npm run commit
```

This will launch an interactive prompt to guide you through creating a properly formatted commit message.

### Commit Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **build**: Build system changes
- **ci**: CI/CD changes
- **chore**: Other changes that don't modify src or test files

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

The project uses [Lefthook](https://github.com/evilmartians/lefthook) for Git hooks:

- **Pre-commit**: Runs linting on staged files
- **Commit-msg**: Validates commit message format with commitlint

## Questions

If you have questions about contributing:

1. Check the [README](README.md) and existing documentation
2. Search [existing issues](https://github.com/AndrewRedican/hyperfrontend/issues)
3. Open a [new issue](https://github.com/AndrewRedican/hyperfrontend/issues/new) with the "question" label

## License

By contributing to hyperfrontend, you agree that your contributions will be licensed under the project's license as specified in the [LICENSE.md](LICENSE.md) file, and you grant the project maintainer the rights specified in the CLA.

---

**Thank you for contributing to hyperfrontend! Your efforts help make this project better for everyone.** 🚀
