# lib-require-module-header

Require a short, substantive `@module` header at the top of entry point files in publishable libraries.

## Rule Details

This rule ensures that all entry point files (main and secondary) in publishable libraries open with a JSDoc comment carrying a `@module` tag, and that the description above that tag says something useful about the module without turning into a document of its own.

The description is the text before the first block tag. It is what a reader sees beside the module in generated API documentation, so it has one job: name the capability or responsibility the module exposes. It is not a README, not an implementation walkthrough, and not a restatement of the module path.

Four things are checked, in order:

| Check                                                                                                     | Default |
| --------------------------------------------------------------------------------------------------------- | ------- |
| A `@module` tag is present, in a JSDoc block on line 1                                                    | always  |
| The header carries a description before its tags                                                          | always  |
| The description is no longer than `maxDescriptionLength` characters                                       | 200     |
| The description is at least `minDescriptionLength` characters                                             | 24      |
| The description carries at least `minSubstantiveWords` words beyond its own module path and shared filler | 3       |

Only the description is measured. Tags, parameter documentation and examples are not counted, because they are not what the length limit is about.

The substantive-word check is what stops a description that only spells the module path back out. Words are stemmed and compared against the path segments plus a small filler vocabulary (`entry`, `point`, `module`, `package`, `index`, articles and prepositions); what remains is what the description actually contributed. Static linting cannot judge prose, so this is a floor rather than a quality bar: it catches "Nx `serve` executor entry point" for `.../nx/executors/serve`, not a fluent sentence that happens to say little.

### Why?

- **Documentation**: The `@module` tag provides a clear identifier for the package documentation
- **TypeDoc Integration**: Module names are used to organize API documentation
- **Discoverability**: Helps users understand what package path to import from
- **Consistency**: All entry points follow the same documentation convention

This rule only applies to publishable libraries (libraries with both `build` and `publish` targets in `project.json`).

## Examples

### ❌ Incorrect

```typescript
// src/index.ts - missing @module header
export * from './repository'
export type { Changelog } from './changelog'
```

```typescript
// src/index.ts - JSDoc without @module tag
/**
 * This is a description without module tag.
 */
export * from './repository'
```

```typescript
// src/index.ts - line comment instead of JSDoc
// @module @hyperfrontend/repo-utils
export * from './repository'
```

```typescript
// src/index.ts - JSDoc not at line 1

/**
 * @module @hyperfrontend/repo-utils
 */
export * from './repository'
```

```typescript
// src/index.ts - no description above the tag
/**
 * @module @hyperfrontend/repo-utils
 */
export * from './repository'
```

```typescript
// src/changelog/index.ts - the description only restates the path
/**
 * Changelog entry point.
 *
 * @module @hyperfrontend/repo-utils/changelog
 */
export type { Changelog } from './models'
```

```typescript
// src/changelog/index.ts - the description became a document
/**
 * Changelog reading and writing.
 *
 * The parser is line-oriented and tolerant: it accepts the Keep a Changelog
 * layout, the older bullet-only layout, and files that mix the two, and it
 * records the layout it found so the serializer can round-trip a file it did
 * not write. Parse and serialize are a fixpoint, which the write step depends
 * on because it re-serializes the whole file rather than splicing into it.
 *
 * @module @hyperfrontend/repo-utils/changelog
 */
export type { Changelog } from './models'
```

### ✅ Correct

```typescript
/**
 * Reads, edits and writes a repository's Git history: commit parsing,
 * changelog round-tripping, and the version arithmetic between them.
 *
 * @module @hyperfrontend/repo-utils
 */
export * from './repository'
export type { Changelog } from './changelog'
```

### Secondary Entry Points

Secondary entry points must also have `@module` headers with the appropriate subpath, and the same description rules apply:

```typescript
// src/changelog/index.ts
/**
 * Parses and serializes a Keep a Changelog file, preserving the layout it was
 * written in.
 *
 * @module @hyperfrontend/repo-utils/changelog
 */
export type { Changelog } from './models'
export { parseChangelog } from './parser'
```

## Entry Point Detection

An index.ts file is considered an entry point if:

1. It is in a publishable library (`project.json` has `projectType: 'library'` with `build` and `publish` targets)
2. It corresponds to an export in `package.json`:
   - Main entry: `src/index.ts` (maps to `"."` export)
   - Secondary entry: Any path declared in `exports` (e.g., `"./changelog": "./src/changelog/index.js"`)

Files that don't match these criteria are ignored by this rule.

## Options

```json
{
  "workspace/lib-require-module-header": [
    "error",
    {
      "maxDescriptionLength": 200,
      "minDescriptionLength": 24,
      "minSubstantiveWords": 3
    }
  ]
}
```

| Option                 | Type    | Default | Meaning                                                                                                                                                          |
| ---------------------- | ------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maxDescriptionLength` | integer | `200`   | Longest permitted description, in characters. Chosen so nine in ten existing headers already comply; the ones that do not are the ones that stopped summarizing. |
| `minDescriptionLength` | integer | `24`    | Shortest permitted description. A floor against an empty gesture, not a target.                                                                                  |
| `minSubstantiveWords`  | integer | `3`     | How many distinct words the description must add beyond its own module path and the shared filler vocabulary.                                                    |

## When Not To Use It

You may want to disable this rule if:

- You don't use TypeDoc or similar documentation generators
- Your project has its own documentation conventions that don't use `@module`
