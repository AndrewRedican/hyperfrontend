---
name: library-generators
version: 1.1.0
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

Generator creates E2E project + CI status workflow. **6 manual entries required:**

| Step | File                                                    | Entry                        |
| ---- | ------------------------------------------------------- | ---------------------------- |
| 1    | `.github/workflows/ci-libraries.yml`                    | Path filter + matrix entry   |
| 2    | `.github/workflows/ci-main.yml`                         | Coverage entry in LIBS array |
| 3    | `README.md`                                             | Row in packages table        |
| 4    | `apps/docs-site/scripts/generate-docs.ts`               | LIBRARIES array entry        |
| 5    | `apps/docs-site/src/lib/content.ts`                     | LIBRARIES array entry        |
| 6    | `apps/docs-site/src/app/docs/libraries/{slug}/page.tsx` | Page route file              |

See `library-ci-workflows` skill for steps 1–2.

---

## Docs-Site Page Template

```tsx
import type { Metadata } from 'next'
import { LibraryDocPage } from '@/components/library-doc-page'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('my-lib')
}

export default function MyLibPage() {
  return (
    <LibraryDocPage
      title="My Lib"
      packageName="@hyperfrontend/my-lib"
      slug="my-lib"
      category="core"
      fallbackDescription="One-line description."
      fallbackFeatures={['Feature 1', 'Feature 2']}
    />
  )
}
```

---

## content.ts Entry Template

```typescript
{
  name: 'My Lib',
  packageName: '@hyperfrontend/my-lib',
  slug: 'my-lib',
  readmePath: 'libs/my-lib/README.md',
  entryPoints: ['libs/my-lib/src/index.ts'],
  category: 'core',
},
```
