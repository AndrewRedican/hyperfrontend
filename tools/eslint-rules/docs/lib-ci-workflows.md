# lib-ci-workflows

Ensure publishable libraries have complete CI/CD workflow configuration.

## Rule Details

This rule validates that all publishable library projects have the necessary CI/CD workflow configuration across multiple files:

1. **Path filter in ci-libraries.yml** - Defines when the library's CI should run
2. **Matrix entry in ci-libraries.yml** - Includes the library in the build matrix
3. **Status workflow file** - Individual `ci-lib-*.yml` for per-project badges
4. **Coverage entry in ci-main.yml** - Enables coverage reporting to Codecov

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

### 1. Path Filter (ci-libraries.yml)

```yaml
filters: |
  my-library:
    - 'libs/my-library/**'
```

### 2. Matrix Entry (ci-libraries.yml)

```bash
add_if_changed "${{ steps.filter.outputs.my-library }}" "lib-my-library" "libs/my-library" "my-library"
```

### 3. Status Workflow File

Create `.github/workflows/ci-lib-my-library.yml`:

```yaml
# Build status reporter for lib-my-library
# This workflow does NOT build - it reports status from ci-libraries.yml matrix build
name: lib-my-library

on:
  workflow_run:
    workflows: [libraries]
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

### 4. Coverage Entry (ci-main.yml)

```bash
LIBS=(
  "my-library:libs/my-library"
)
```

## Examples

### ❌ Incorrect

Missing path filter for a publishable library:

```yaml
# ci-libraries.yml
filters: |
  # Missing: my-new-library:
  #   - 'libs/my-new-library/**'
  existing-library:
    - 'libs/existing-library/**'
```

Missing status workflow file:

```
.github/workflows/
├── ci-libraries.yml
├── ci-main.yml
├── ci-lib-existing-library.yml
└── # Missing: ci-lib-my-new-library.yml
```

### ✅ Correct

Complete configuration for all publishable libraries:

```yaml
# ci-libraries.yml
filters: |
  my-new-library:
    - 'libs/my-new-library/**'
  existing-library:
    - 'libs/existing-library/**'
```

```yaml
# ci-main.yml
LIBS=(
"my-new-library:libs/my-new-library"
"existing-library:libs/existing-library"
)
```

```
.github/workflows/
├── ci-libraries.yml
├── ci-main.yml
├── ci-lib-existing-library.yml
└── ci-lib-my-new-library.yml
```

## When Not To Use It

- If your project doesn't use the matrix-based CI workflow pattern
- If you have a different CI/CD setup that doesn't follow this structure
- For libraries that are intentionally excluded from CI (comment them out with explanation)

## Related Rules

- [lib-project-metadata](./lib-project-metadata.md) - Validates project.json metadata
- [root-readme-packages](./root-readme-packages.md) - Ensures libraries are documented in README
