---
name: jsdoc-examples
version: 1.0.0
description: Write high-value @example blocks in JSDoc. Use when documenting functions, adding API examples, writing library docs, reviewing doc quality, or asked about examples.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
---

# JSDoc Examples

Examples teach what types can't. **No net-new value → no example.**

---

## ESLint Rule

`@hyperfrontend/lib-require-jsdoc-example` enforces examples on exported APIs in publishable libs.
Docs: `tools/eslint-rules/docs/lib-require-jsdoc-example.md`

---

## When to Write

| Write                     | Skip                           |
| ------------------------- | ------------------------------ |
| Non-obvious behavior      | Type signature says it all     |
| Error boundaries / throws | Every param permutation        |
| Edge cases that surprise  | "Works as typed" demos         |
| Composition / integration | Trivial variations             |
| Config gotchas / defaults | Uniform behavior across inputs |
| Frequently-used canonical | Simple delegating wrappers     |

- When criteria is not met, skip enforcement by adding exactly `/* eslint-disable workspace/lib-require-jsdoc-example */` at the top of the file. We cannot inline disable because it would conflict with jsdoc comments themselves which need to be above the code it is for.

---

## How to Write

- One concept per example
- Minimal reproducible context
- Realistic names (`userId`, `config`) not `foo`, `bar`
- Show output when result shape non-obvious
- Title when >1 example on same API
- Must compile when copy-pasted

---

## Patterns

**Format** — wrap code in triple backticks:

````typescript
/**
 * @example
 * ```typescript
 * const result = myFunction(input)
 * // => expected output
 * ```
 */
````

**Multiple** — title each `@example`:

````typescript
/**
 * @example Basic usage
 * ```typescript
 * fetchUser(123)
 * ```
 *
 * @example With options
 * ```typescript
 * fetchUser(123, { include: ['posts'] })
 * ```
 */
````
