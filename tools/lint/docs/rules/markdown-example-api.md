# markdown-example-api

Ensure the code examples in Markdown use API that exists, so a README or an ARCHITECTURE.md cannot go on showing a function after the package stopped exporting it.

## Rule Details

Documentation examples are not compiled, so nothing fails when the API under them changes. An `@example` in a JSDoc block sits beside the code it describes and is reviewed with it; a fenced block in a README, an ARCHITECTURE.md or a guide sits far from it and drifts.

This rule reads every fenced block whose language is TypeScript or JavaScript (`ts`, `typescript`, `tsx`, `mts`, `cts`, `js`, `javascript`, `jsx`, `mjs`, `cjs`) in every Markdown file except `CHANGELOG.md`, parses it, and makes two checks.

### 1. What an example takes from a workspace package exists

Wherever an example names a publishable workspace package, the entry point it names is one the package's `exports` map has, and every name taken from it is one that entry point exports:

| Form                 | Example                                                  | Checked                       |
| -------------------- | -------------------------------------------------------- | ----------------------------- |
| Named import         | `import { parse } from '@hyperfrontend/versioning'`      | `parse`                       |
| Type import          | `import type { Options } from '…/sub'`                   | `Options`                     |
| Namespace import     | `import * as semver from '…'`, then `semver.parse`       | `parse`, at each use          |
| Re-export            | `export { parse } from '…'`                              | `parse`                       |
| `require`            | `const { parse } = require('…')`                         | `parse`                       |
| Whole-module binding | `const lib = require('…')`, then `lib.parse`             | `parse`, at each use          |
| Dynamic import       | `const { parse } = await import('…')`                    | `parse`                       |
| Entry point          | any of the above, `export * from '…'`, a bare `import()` | the subpath after the package |

A default import and the package's `package.json` subpath are not checked. A package the workspace does not publish (`react`, a private project) is not checked either.

When another entry point of the same package exports the name, the message says which, since the usual cause is a name that moved to a secondary entry point.

### 2. A function an example calls at its top level is provided

In a publishable package's own documentation, a function or constructor an example calls **at its top level** must come from somewhere. It is provided when any of these holds:

- the example declares or imports the name, anywhere in the block;
- it is a language, browser, Node or test-runner global (`parseInt`, `fetch`, `expect`);
- an entry point of any workspace package exports it;
- the package's own sources declare it, exported or not, as an ARCHITECTURE.md describing internals needs.

Only top-level calls are checked. What an example runs itself is what it demonstrates; what sits inside a function body is the reader's to supply, a `render(state)` or a `handle(message)` standing in for their own code. Member calls (`store.dispatch()`) are not checked, as the receiver's type is not known.

An example that shows what **not** to write marks it with ❌, on the line of the call or on a comment line above it. The nearest ❌ or ✅ at or above a call speaks for it, so a block may show both.

### What is not checked

- A block that does not parse, such as a sketch with `...` in it: it states no API precisely enough to check.
- Calls inside function bodies, member calls, and names that are only read.
- Inline code in prose. [`lib-inline-code-links`](./lib-inline-code-links.md) covers it: a name there must link to documentation that resolves.
- `@example` blocks in JSDoc. [`lib-require-jsdoc-example`](./lib-require-jsdoc-example.md) requires them, beside the code they describe.

### Why?

- **Examples are the documentation readers copy.** An import that no longer resolves fails at the reader's first paste.
- **Drift is silent.** No build, test or type check reads a Markdown file.
- **The fix is usually one line.** Most findings are a name that moved to a secondary entry point or was renamed.

## Examples

### ❌ Incorrect

A name the entry point does not export:

```typescript
import { classifyCommits } from '@hyperfrontend/versioning'
// Error: Example takes `classifyCommits` from `@hyperfrontend/versioning`, which exports no `classifyCommits`. It is exported by `@hyperfrontend/versioning/commits`, `@hyperfrontend/versioning/commits/classify`. Update the example to the API as it is now.
```

An entry point the package does not have:

```typescript
import { createBroker } from '@hyperfrontend/nexus/broker'
// Error: Example imports from `@hyperfrontend/nexus/broker`, but @hyperfrontend/nexus has no entry point `./broker`. Update the example to the API as it is now.
```

A top-level call nothing provides, in `libs/versioning/ARCHITECTURE.md`:

```typescript
const context = createFlowContext({ workspaceRoot, projectName })
// Error: Example calls `createFlowContext`, which nothing provides: the example neither declares nor imports it, and no workspace package exports or declares it. Import it from where it lives now, declare it in the example, or mark a counter-example with ❌.
```

### ✅ Correct

```typescript
import { classifyCommits } from '@hyperfrontend/versioning/commits/classify'
import { createVersionFlow } from '@hyperfrontend/versioning'

const flow = createVersionFlow('conventional')

// the reader's own function, inside a callback
queueMicrotask(() => report(flow))
```

A counter-example, marked:

```typescript
// ✅ built once per tree and shared
const analysis = scopeAnalysisOf(context)
// ❌ rebuilt by every rule
const again = analyseScopes(context.tree)
```

## Configuration

```javascript
// lint.base.config.ts
{
  // a rule's own documentation shows the code the rule reads, not a use of an API
  files: ['**/*.md'],
  ignores: ['**/docs/rules/**'],
  rules: {
    'workspace/markdown-example-api': 'error',
  },
}
```

The rule takes no options.

## Related Rules

- [lib-inline-code-links](./lib-inline-code-links.md) - Ensures inline code naming an API links to documentation that resolves
- [lib-require-jsdoc-example](./lib-require-jsdoc-example.md) - Ensures every exported function carries an example
