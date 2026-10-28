---
name: library-ci-workflows
description: Configure CI/CD workflows for publishable hyperfrontend libraries. Use when adding CI configuration for a new library, fixing lib-ci-workflows lint errors, or wiring a library's status badge and coverage upload.
---

# Library CI Workflows

`make-publishable` writes both pieces: the status workflow and the coverage entry. The entries below are what it writes, for fixing a library registered some other way, or a `lib-ci-workflows` report by hand.

Lint rule: `workspace/lib-ci-workflows`, run on `.github/workflows/ci-main.yml`

---

## How a Library Gets Built

Nothing per library decides when CI runs it. Every pull request and every push to `main` plans its work from the owned pipeline (`tools/workspace`): the plan reads the project graph, selects the tasks of the projects a change reaches, and the environment jobs execute them. There is no path filter or matrix entry to register; a new library is in the plan as soon as its project exists.

## Entries the Rule Expects

### 1. Status Workflow → `.github/workflows/ci-<project-name>.yml`

The badge source. It builds nothing: when the `ci` workflow (`ci-main.yml`) completes on `main`, `_lib-status.yml` downloads the `pipeline-results-linux` artifact of the newest completed runs and reports the outcome of the library's tasks, walking back to an older run while the library had none.

```yaml
name: lib-my-utils

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
      project-name: lib-my-utils
      library-path: libs/utils/my
```

### 2. Coverage Entry → `.github/workflows/ci-main.yml`

The Linux environment uploads every library's coverage to Codecov from the `LIBS` array, one `"flag:path"` line per library. The flag is the folder name, utilities suffixed `-utils`; packages under `libs` come before the utilities, each group alphabetical by flag.

```bash
LIBS=(
  "my-utils:libs/utils/my"
)
```

## Renames and Moves

A rename keeps the project root, so the coverage entry stays: rename the status workflow and update its `name:` and `project-name:`. A move changes the root: update the coverage entry and the status workflow's `library-path:` as well.
