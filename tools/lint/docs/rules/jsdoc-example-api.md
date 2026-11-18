# jsdoc-example-api

Ensure the code examples in JSDoc blocks take from a workspace package only what it exports, so an `@example` cannot go on importing a name after it moved or was removed.

## Rule Details

[`lib-require-jsdoc-example`](./lib-require-jsdoc-example.md) requires an example on every exported function, and the documentation site renders each one into the API reference. Nothing compiles them. When a function moves to a secondary entry point, is renamed, or stops being exported, the import line of its own example goes on naming the old place, and a reader who copies it gets an import that does not resolve.

This rule reads every JSDoc block of every code file. In each it takes:

- every fenced block whose language is TypeScript or JavaScript, or that names no language;
- the text of an `@example` written without a fence, up to the next tag.

It parses each as an example and checks what the example takes from a publishable workspace package, exactly as [`markdown-example-api`](./markdown-example-api.md) does for Markdown: a named or type import, a namespace import and its members, a re-export, a `require` or dynamic import and what is destructured from it, and a bundle global. The entry point named must be one the package's `exports` map has, and each name must be one that entry point exports. An example that does not parse still has its `import … from` statements read.

When another entry point of the same package exports the name, the message says which.

### What is not checked

Calls are left alone here, which is the one difference from the Markdown rule. An example beside the code it describes shows that code in a setting, `saveDraft().then(…)` or `mountPanel(container)`, and the setting is the reader's. Measured on this workspace's 2,052 JSDoc examples, 25 top-level calls named nothing the workspace provides, and none of them was a removed API.

### Why?

- **The example is the reference.** The site prints each `@example` under its function; a stale import there is a stale API reference.
- **Internal functions are the usual culprits.** A helper that was never exported from the package often carries an example that imports it from the package root, which no reader can do.
- **Drift is silent.** No build or type check reads a comment.

## Examples

### ❌ Incorrect

A name the package root does not export, because it lives on a secondary entry point:

````typescript
/**
 * @example
 * ```typescript
 * import { clearTechDetectionCache } from '@hyperfrontend/project-scope'
 * ```
 */
// Error: Example takes `clearTechDetectionCache` from `@hyperfrontend/project-scope`, which exports no `clearTechDetectionCache`. It is exported by `@hyperfrontend/project-scope/tech`. Update the example to the API as it is now.
````

A name the package exports nowhere:

````typescript
/**
 * @example
 * ```typescript
 * import { createNoopStep, executeStep } from '@hyperfrontend/versioning'
 *
 * const result = await executeStep(createNoopStep('noop', 'Noop'), context)
 * ```
 */
// Error: Example takes `executeStep` from `@hyperfrontend/versioning`, which exports no `executeStep`. Update the example to the API as it is now.
````

### ✅ Correct

````typescript
/**
 * @example
 * ```typescript
 * import { createNoopStep } from '@hyperfrontend/versioning'
 *
 * const step = createNoopStep('noop', 'Noop')
 * const result = await step.execute(context)
 * ```
 */
````

An internal function, which no package exports, shows its use without an import:

````typescript
/**
 * @example
 * ```typescript
 * const message = interpolate('release ${version}', { version: '1.2.0' })
 * ```
 */
````

## Configuration

```javascript
// lint.base.config.ts
{
  files: SCRIPT,
  rules: {
    'workspace/jsdoc-example-api': 'error',
  },
}
```

The rule takes no options.

## Related Rules

- [markdown-example-api](./markdown-example-api.md) - Makes the same check of the examples in Markdown, and checks their top-level calls
- [lib-require-jsdoc-example](./lib-require-jsdoc-example.md) - Ensures every exported function carries an example
