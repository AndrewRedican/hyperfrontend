---
name: library-ci-workflows
description: Configure CI/CD workflows for publishable hyperfrontend libraries. Use when adding CI configuration for a new library, fixing lib-ci-workflows lint errors, or setting up path filters for library builds.
---

# Library CI Workflows

`make-publishable` writes all four pieces: the status workflow, the path filter, the matrix entry and the coverage entry. The entries below are what it writes, for fixing a library registered some other way, or a `lib-ci-workflows` report by hand.

ESLint rule: `lib-ci-workflows`

---

## Entries the Rule Expects

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
