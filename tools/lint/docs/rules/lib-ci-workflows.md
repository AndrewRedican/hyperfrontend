# lib-ci-workflows

Ensure publishable libraries have complete CI/CD workflow configuration.

## Rule Details

This rule runs on `.github/workflows/ci-main.yml` and validates that every publishable library project has the CI/CD configuration the pipeline cannot derive on its own:

1. **Status workflow file** - Individual `ci-lib-*.yml` for per-project badges
2. **Coverage entry in ci-main.yml** - Enables coverage reporting to Codecov

Nothing selects which libraries CI runs: every pull request and every push to `main` plans its work from the owned pipeline (`tools/workspace`), which reads the project graph and runs the tasks of the projects a change reaches. There is no per-library path filter or matrix entry to register.

### What is a Publishable Library?

A project is considered a publishable library if:

1. Located in `libs/` or `plugins/` directory
2. Has a `project.json` with `projectType: "library"`
3. Has both `build` and `publish` targets defined

### Coverage Flag Derivation

The rule automatically derives the coverage flag from the library path:

- `libs/network-protocol` → `network-protocol`
- `libs/utils/json` → `json-utils`
- `plugins/features` → `features`

### Why?

- **Consistency**: Ensures all publishable libraries have complete CI/CD setup
- **Automation**: Catches missing configuration before merge
- **Visibility**: Per-project badges show build status accurately
- **Coverage**: All library coverage is tracked in Codecov

## Required Configuration

For a library at `libs/my-library` with project name `lib-my-library`:

### 1. Status Workflow File

Create `.github/workflows/ci-lib-my-library.yml`. It builds nothing: when the `ci` workflow completes on `main`, `_lib-status.yml` reads the pipeline results the run uploaded and reports the outcome of the library's tasks, walking back to older runs while the library had none.

```yaml
# Build status reporter for lib-my-library
# This workflow does NOT build - it reports the outcome of the library's tasks in the ci workflow's results on main
name: lib-my-library

on:
  workflow_run:
    workflows: [ci]
    types: [completed]
    branches: [main]

permissions:
  actions: read

jobs:
  status:
    uses: ./.github/workflows/_lib-status.yml
    with:
      project-name: lib-my-library
      library-path: libs/my-library
```

### 2. Coverage Entry (ci-main.yml)

```bash
LIBS=(
  "my-library:libs/my-library"
)
```

## Examples

### ❌ Incorrect

Missing coverage entry for a publishable library:

```yaml
# ci-main.yml
LIBS=(
  # Missing: "my-new-library:libs/my-new-library"
  "existing-library:libs/existing-library"
)
```

Missing status workflow file:

```
.github/workflows/
├── ci-main.yml
├── ci-lib-existing-library.yml
└── # Missing: ci-lib-my-new-library.yml
```

### ✅ Correct

Complete configuration for all publishable libraries:

```yaml
# ci-main.yml
LIBS=(
"my-new-library:libs/my-new-library"
"existing-library:libs/existing-library"
)
```

```
.github/workflows/
├── ci-main.yml
├── ci-lib-existing-library.yml
└── ci-lib-my-new-library.yml
```

## When Not To Use It

- If your project doesn't report per-library badges from the main workflow's pipeline results
- If you have a different CI/CD setup that doesn't follow this structure

## Related Rules

- [lib-project-metadata](./lib-project-metadata.md) - Validates project.json metadata
- [root-readme-packages](./root-readme-packages.md) - Ensures libraries are documented in README
