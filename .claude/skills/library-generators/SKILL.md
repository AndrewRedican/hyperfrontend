---
name: library-generators
description: Use @hyperfrontend/package generators to create, promote, rename, or move libraries. Use when scaffolding a new library, promoting internal to publishable, renaming a project, or relocating a library directory.
---

# Library Generators

All support `--dry-run`.

The generators are the packaged ones of `@hyperfrontend/workspace` (`libs/workspace/src/generators`: `workspace`, `library`, `make-publishable`, `rename`, `move`), wrapped by `tools/package/src/generators` with this repository's conventions: the `@hyperfrontend` scope, the `lib-<name>` project name, the `type:`/`scope:` tags, the lint template that turns on the workspace rules, the compatibility block, the README badges, the CI workflow and the registrations. A bare name resolves to the wrapper here; `@hyperfrontend/workspace:<name>` reaches the packaged one. The packaged `library` takes `scope`, `projectName`, `packageName`, `tags`, `keywords` and `formats` and writes a `build` target in both module formats, which the wrapper removes for an internal library here; the packaged `make-publishable` takes `formats` (`esm,cjs,iife,umd`), `buildExecutor`, `e2eDirectory` and `nodeEngine`; `workspace` writes `hf.json`, `tsconfig.base.json`, `lint.base.config.ts` and `.hfignore` into an outside repository and is not used here.

---

## Commands

```bash
# Create internal library
npx hf generate library --name=my-utils --type=util --description="..."

# Create nested (libs/utils/my)
npx hf generate library --name=my-utils --directory=libs/utils \
  --type=util --description="..."

# Create publishable
npx hf generate library --name=my-utils --type=util --description="..." \
  --publishable --compatibility=isomorphic

# Promote to publishable
npx hf generate make-publishable --project=lib-my-utils \
  --compatibility=isomorphic

# Choose where the docs site lists it (both default: utils for libs/utils/*, core for type:core, else supporting; utilities for a utility, else standalone)
npx hf generate make-publishable --project=lib-my-utils \
  --compatibility=node-only --docsCategory=core --ecosystemTier=tooling

# Rename
npx hf generate rename --project=lib-my-utils --newName=my-helpers

# Move
npx hf generate move --project=lib-my-utils --destination=libs/utils

# Preview any of them without writing
npx hf generate library --name=my-utils --type=util --description="..." \
  --dry-run
```

---

## Runtime Compatibility

The publishable path asks "Where does this package run?" and writes the answer to `metadata.compatibility` in project.json: `isomorphic`, `node-only`, or `browser-only`. It also declares `operatingSystems` as `full` on `linux`, `macos` and `windows`, the three legs every library runs on. Internal libraries are never asked and get no metadata block; `partial` support and a `note` are added by hand afterwards.

---

## What make-publishable Writes

Besides the project's own files, the E2E project and the status workflow, the generator registers the package everywhere the workspace lists its packages. Every registration is written only when missing, so re-running it changes nothing.

| Surface                                                    | What is written                                                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci-main.yml`                            | `"flag:path"` in the `LIBS` array, alphabetical within the libs group or the utils group                         |
| `README.md`                                                | Row in the Packages table after the package the ecosystem hierarchy places before it; summary count              |
| `apps/docs-site/scripts/generate-docs.ts`                  | `LIBRARIES` entry; `LIBRARY_SLUGS` entry for a core or supporting package                                        |
| `apps/docs-site/src/lib/content.ts`                        | `LIBRARIES` entry with every export's entry point and the architecture document when `ARCHITECTURE.md` exists    |
| `apps/docs-site/src/lib/navigation.ts`                     | Entry in the section's array at its alphabetical position, one child per secondary export (plus architecture)    |
| `apps/docs-site/src/lib/ecosystem.ts`                      | Package appended to the `--ecosystemTier` level of `ECOSYSTEM_TIERS`                                             |
| `apps/docs-site/src/app/docs/libraries/{slug}/**/page.tsx` | `page.tsx`, `releases/page.tsx`, `architecture/page.tsx` when the document exists, one page per secondary export |

`package.json` keeps the `engines`, `peerDependencies` and `peerDependenciesMeta` the project already declares; the README's Node badge and compatibility row read the declared floor. The licence, the repository (with the project's `directory`) and the funding come from the root `package.json`.

**Left to do by hand**: record the package banner and runtime strip (`npx hf run tool-media:media --scene=banner-{slug} --scene=runtimes-{slug}`), replace the README template's placeholder sections, and add `fallbackFeatures` to the docs page if the README cannot supply key features. Leave `package.json` at version `0.0.0` and never seed a `CHANGELOG.md`: the versioning flow computes the first version from the commits and writes the changelog with it, and until then the `releases` page answers not found and the sitemap check skips it.

The transforms live in `tools/package/src/generators/make-publishable/lib/` as pure functions with specs beside them; the CI entries are the ones `lib-ci-workflows` checks, and the docs-site entries are the ones `docs-site-libraries`, `docs-site-routes`, `docs-site-secondary-entries` and `docs-site-library-docs` check.

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
