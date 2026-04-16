---
name: library-generators
version: 1.0.0
description: Use @hyperfrontend/package generators to create, promote, rename, or move libraries. Use when scaffolding a new library, promoting internal to publishable, renaming a project, or relocating a library directory.
allowed-tools:
  - Read
  - Write
  - Edit
  - Terminal
---

# Library Generators

All support `--dry-run`.

---

## Commands

```bash
# Create internal library
nx generate @hyperfrontend/package:library --name=my-utils --type=util --description="..."

# Create nested (libs/utils/my)
nx generate @hyperfrontend/package:library --name=my-utils --directory=libs/utils --type=util --description="..."

# Create publishable
nx generate @hyperfrontend/package:library --name=my-utils --type=util --description="..." --publishable

# Promote to publishable
nx generate @hyperfrontend/package:make-publishable --project=lib-my-utils

# Rename
nx generate @hyperfrontend/package:rename --project=lib-my-utils --newName=my-helpers

# Move
nx generate @hyperfrontend/package:move --project=lib-my-utils --destination=libs/utils
```

---

## make-publishable Manual Steps

Generator creates E2E project + CI status workflow. Still requires:

1. Add path filter + matrix entry → `.github/workflows/ci-libraries.yml`
2. Add row → root `README.md` packages table
3. Add entry → `apps/docs-site/scripts/generate-docs.ts`

See `library-ci-workflows` skill for CI patterns.
