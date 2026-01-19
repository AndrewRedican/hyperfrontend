# Local Workflow Testing

This directory contains test event files for local GitHub Actions workflow testing using [act](https://github.com/nektos/act).

## Prerequisites

Install `act`:

```bash
# macOS
brew install act

# Linux
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Or via npm
npm install -g @openedition/act
```

## Test Event Files

- **pr-opened.json**: Simulates a pull request opened event
- **push-main.json**: Simulates a push to the main branch

## Testing Commands

### Test PR Validation Workflow

```bash
# Test the complete PR workflow
act pull_request -W .github/workflows/ci-pr.yml -e .github/test-events/pr-opened.json

# Test a specific job
act pull_request -j setup -W .github/workflows/ci-pr.yml
act pull_request -j format -W .github/workflows/ci-pr.yml
act pull_request -j lint -W .github/workflows/ci-pr.yml
act pull_request -j build -W .github/workflows/ci-pr.yml
act pull_request -j test -W .github/workflows/ci-pr.yml
```

### Test Main Branch Workflow

```bash
# Test the complete main branch workflow
act push -W .github/workflows/ci-main.yml -e .github/test-events/push-main.json

# Test a specific job
act push -j format -W .github/workflows/ci-main.yml
act push -j lint -W .github/workflows/ci-main.yml
act push -j build -W .github/workflows/ci-main.yml
act push -j test -W .github/workflows/ci-main.yml
```

### Test Custom Actions

```bash
# Test setup-monorepo action
act -j setup -W .github/workflows/ci-pr.yml

# Test nx-affected action (requires a branch with changes)
git checkout -b test-affected
# Make some changes
git add .
git commit -m "Test changes"
act pull_request -j setup -W .github/workflows/ci-pr.yml

# Test run-checks action
act pull_request -j format -W .github/workflows/ci-pr.yml
```

### Test Security Workflow

```bash
# Test security scanning
act push -W .github/workflows/security-scan.yml

# Test specific security jobs
act push -j codeql-analysis -W .github/workflows/security-scan.yml
act push -j dependency-audit -W .github/workflows/security-scan.yml
```

## Useful act Options

- `--dry-run`: Show what would be run without actually running it
- `--list`: List all available workflows and jobs
- `--verbose`: Enable verbose logging
- `--reuse`: Reuse containers between runs (faster)
- `--container-architecture linux/amd64`: Specify container architecture
- `-s GITHUB_TOKEN=<token>`: Pass GitHub token for authenticated API calls

## Checking Workflow Output

### Cache Behavior

Look for these messages in the output:

- `Cache hit: true` - npm dependencies were cached
- `Cache hit: false` - dependencies were installed fresh

### Affected Projects

Look for messages like:

- `Affected projects: package1,package2,package3`
- `No affected projects found`

### Check Results

Look for success/failure messages:

- `✅ All CI checks passed`
- `❌ One or more CI checks failed`

## Troubleshooting

### Docker Issues

If you encounter Docker permission issues:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Act Not Finding Workflows

Make sure you're in the repository root:

```bash
cd /workspaces/hyperfrontend
```

### Secrets Required

Some workflows may require secrets. Pass them with:

```bash
act -s GITHUB_TOKEN=$GITHUB_TOKEN
```

## Notes

- Local testing with `act` uses Docker containers, so it may be slower than GitHub Actions
- Some features like GitHub API calls may not work exactly the same locally
- Cache behavior may differ between local and GitHub Actions environments
- Custom actions (composite actions) are fully supported by `act`
