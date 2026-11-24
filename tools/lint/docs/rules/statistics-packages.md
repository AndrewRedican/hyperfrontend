# statistics-packages

Ensure the statistics service tracks every publishable library: its `packages` list names each one by package name, once, and names nothing else.

## Rule Details

The statistics service collects the npm download history of the packages this workspace publishes. Which packages those are is a hand-written list: the `packages` array in the `immutable` section of `apps/statistics/service.config.ts`. Nothing else keeps that list in step with the workspace, so a library added later would never be tracked and nothing would fail.

This rule reads the default export of that file, finds `immutable.packages`, and compares its string literals with the package names of the workspace's publishable libraries. It reports:

- a publishable library whose package name the list lacks, on the array
- an entry that is not the package name of a publishable library, on the entry
- an entry written again, on every occurrence after the first
- a list it cannot read, once, on the node closest to the problem

A library counts from the commit that adds it, whatever its version: one still at `0.0.0` ahead of its first release is expected in the list, since the service tolerates a package npm does not know yet.

### What is a Publishable Library?

A project is considered a publishable library if:

1. Located in `libs/` or `plugins/` directory
2. Has a `project.json` with `projectType: "library"`
3. Has both `build` and `publish` targets defined
4. Has a `package.json` with a `name` field that is a string

This is the definition [docs-site-libraries](./docs-site-libraries.md) uses, read through the same helper.

### What can the rule read?

The default export must be an object literal whose `immutable` member is an object literal whose `packages` member is an array of string literals. A type assertion (`as const`) or a `satisfies` check around any of the three is looked through. Where a key is written twice, the last one counts, as it does when the file runs.

Anything else is reported once and judged no further: a file without a default export (reported at the top of the file), a default export that is a name or a call, a missing `immutable` or `packages` member, a `packages` value that is not an array, and an array holding a spread, a name, a template, a number or a hole. The list has to be readable without running the file, so a name the rule would have to resolve does not count as listed.

### Fix

The missing-library report is fixable. `--fix` inserts every missing package name in one pass:

- when the existing entries are in ascending order, each name goes before the first entry that sorts after it, so the list stays in order
- when they are not, the names are appended after the last entry, themselves in ascending order

Order is the order of `Array.prototype.sort()` with no comparator, which for package names is plain alphabetical order.

The inserted entries copy the quotes of the first entry and the separator between the first two entries, so a list written one entry per line stays one entry per line. An empty list is filled on one line, for the formatter to wrap.

No fix is offered when the brackets hold anything besides entries, commas and whitespace: a comment belongs to the entry beside it, and an insertion cannot tell which side that is. The report is the same; the entry is added by hand.

The other reports are never fixed: whether an unknown entry is a typo, a renamed package or a library that was removed is a judgement the rule cannot make.

### Why?

- **Completeness**: a new library is tracked from the commit that adds it, not from the day someone remembers
- **No dead entries**: a renamed or removed package does not keep being asked for
- **One collection per package**: an entry written twice is caught before the service is built
- **Maintainability**: the list fails lint, not silently, when the workspace changes

## Examples

### ❌ Incorrect

The examples read a workspace whose publishable libraries are `libs/logging`, published as `@hyperfrontend/logging`, and `libs/nexus`, published as `@hyperfrontend/nexus`.

A publishable library the list lacks:

```typescript
// apps/statistics/service.config.ts
export default {
  immutable: {
    packages: ['@hyperfrontend/logging'],
  },
}
```

**Error**: `Publishable library '@hyperfrontend/nexus' (libs/nexus) is not listed in immutable.packages, so the service would never collect its downloads`

`--fix` rewrites the list to `['@hyperfrontend/logging', '@hyperfrontend/nexus']`.

An entry no publishable library publishes under:

```typescript
export default {
  immutable: {
    packages: [
      '@hyperfrontend/logging',
      '@hyperfrontend/nexsu', // reported here
      '@hyperfrontend/nexus',
    ],
  },
}
```

**Error**: `'@hyperfrontend/nexsu' is not the package name of a publishable library of this workspace`

An entry written twice:

```typescript
export default {
  immutable: {
    packages: [
      '@hyperfrontend/logging',
      '@hyperfrontend/nexus',
      '@hyperfrontend/nexus', // reported here
    ],
  },
}
```

**Error**: `'@hyperfrontend/nexus' is listed more than once in immutable.packages`

A list the rule cannot read:

```typescript
import { PACKAGES } from './src/packages'

export default {
  immutable: {
    packages: [...PACKAGES],
  },
}
```

**Error**: `The default export must be an object literal whose immutable.packages is an array of string literals, one per tracked package`

### ✅ Correct

Every publishable library, once:

```typescript
export default {
  immutable: {
    packages: ['@hyperfrontend/logging', '@hyperfrontend/nexus'],
  },
}
```

## Configuration

Apply this rule to the service's configuration file:

```javascript
// apps/statistics/lint.config.ts
export default [
  // ... other configs
  {
    files: ['service.config.ts'],
    rules: {
      'workspace/statistics-packages': 'error',
    },
  },
]
```

The rule judges `apps/statistics/service.config.ts` alone; switched on for any other file, it reports nothing.

## When Not To Use

- If the service should deliberately track a subset of the published packages
- If the list is moved out of `service.config.ts` or computed when the service is built

## Related Rules

- [docs-site-libraries](./docs-site-libraries.md) - Ensures publishable libraries are listed in the docs site's LIBRARIES arrays
- [root-readme-packages](./root-readme-packages.md) - Ensures publishable libraries are listed in root README.md
