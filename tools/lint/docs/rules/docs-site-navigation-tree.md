# docs-site-navigation-tree

Ensure the docs-site navigation lists a package's pages as the tree their routes form, so every package breaks its subpaths down the same way.

## Rule Details

The sidebar and the mobile drawer both render `apps/docs-site/src/lib/navigation.ts`. A package's pages can be written there two ways: nested, where `bundle` holds `declarations` and `dedupe`, or flat, where the package holds `bundle/declarations` and `bundle/dedupe` as siblings. Mixed, one package collapses its subpaths into groups while the next spells every path out in full.

This rule keeps the nested form. For every entry below a package (an entry with a `packageName` and an `href`), it asserts:

1. **One segment per entry.** A `slug` holds no `/`.
2. **The link is the place.** An `href` is the parent's path followed by the entry's `slug`. The parent's path is its `href`, or for a group without one, its own place in the tree.
3. **A page is linked.** A group without an `href` has no `page.tsx` at its place under `apps/docs-site/src/app`. When the site has that page, the group links to it.

Entries outside a package (`Getting Started`, `Contributing`) name pages by title and are not checked.

[`docs-site-secondary-entries`](./docs-site-secondary-entries.md) asserts that each entry point has a link somewhere in the file; this rule asserts where in the tree that link sits.

### Why?

- **One reading of every package**: a reader who learns that `bundle` expands into its entries finds `executors` behaving the same way.
- **Shorter labels**: nested entries read `build`, `e2e`, `publish` under `executors` instead of repeating the prefix on every line of a narrow column.
- **Both navigations at once**: the desktop sidebar and the mobile drawer read the same tree, so one correction fixes both.

## Examples

### ❌ Incorrect

Subpaths listed flat:

```typescript
{
  slug: 'workspace',
  packageName: '@hyperfrontend/workspace',
  href: '/docs/libraries/workspace',
  children: [
    { slug: 'executors/build', href: '/docs/libraries/workspace/executors/build' },
    { slug: 'executors/e2e', href: '/docs/libraries/workspace/executors/e2e' },
  ],
}
// Error: Navigation entry 'executors/build' spans more than one path segment. An entry names one segment: list 'build' in the children of an entry for 'executors'.
```

An entry listed beside its parent instead of under it:

```typescript
children: [
  { slug: 'generators', href: '/docs/libraries/workspace/generators' },
  { slug: 'library', href: '/docs/libraries/workspace/generators/library' },
]
// Error: Navigation entry 'library' links to '/docs/libraries/workspace/generators/library', but its place in the tree is '/docs/libraries/workspace/library'. List it in the children of the entry for its parent path.
```

A group that hides its own page:

```typescript
{ slug: 'generators', children: [{ slug: 'library', href: '/docs/libraries/workspace/generators/library' }] }
// Error: Navigation entry 'generators' groups the pages under '/docs/libraries/workspace/generators', which is a page itself. Give it href: '/docs/libraries/workspace/generators'.
```

### ✅ Correct

```typescript
{
  slug: 'workspace',
  packageName: '@hyperfrontend/workspace',
  href: '/docs/libraries/workspace',
  children: [
    {
      // no page at /docs/libraries/workspace/executors, so the group carries no href
      slug: 'executors',
      children: [
        { slug: 'build', href: '/docs/libraries/workspace/executors/build' },
        { slug: 'e2e', href: '/docs/libraries/workspace/executors/e2e' },
      ],
    },
    {
      slug: 'generators',
      href: '/docs/libraries/workspace/generators',
      children: [{ slug: 'library', href: '/docs/libraries/workspace/generators/library' }],
    },
  ],
}
```

## Configuration

```javascript
// apps/docs-site/lint.config.ts
{
  files: ['src/lib/navigation.ts'],
  rules: {
    'workspace/docs-site-navigation-tree': 'error',
  },
}
```

## Related Rules

- [docs-site-routes](./docs-site-routes.md) - Ensures every listed library has its page and navigation link
- [docs-site-secondary-entries](./docs-site-secondary-entries.md) - Ensures every secondary entry point has its page and navigation link
