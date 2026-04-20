---
name: library-ci-workflows
version: 1.0.0
description: Configure CI/CD workflows for publishable hyperfrontend libraries. Use when adding CI configuration for a new library, fixing lib-ci-workflows lint errors, or setting up path filters for library builds.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
---

# Library CI Workflows

`make-publishable` creates status workflow. Three manual entries required.

ESLint rule: `lib-ci-workflows`

---

## Manual Steps

### 1. Path Filter → `.github/workflows/ci-libraries.yml`

```yaml
filters: |
  my-utils:
    - 'libs/utils/my/**'
```

### 2. Matrix Entry → `.github/workflows/ci-libraries.yml`

```bash
add_if_changed "${{ steps.filter.outputs.my-utils }}" "lib-my-utils" "libs/utils/my" "my-utils"
```

### 3. Coverage Entry → `.github/workflows/ci-main.yml`

```bash
LIBS=(
  "my-utils:libs/utils/my"
)
```
