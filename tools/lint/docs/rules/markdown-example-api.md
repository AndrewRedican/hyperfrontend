# markdown-example-api

Ensure the code examples in Markdown use API that exists, so a README or an ARCHITECTURE.md cannot go on showing a function after the package stopped exporting it.

## Rule Details

Documentation examples are not compiled, so nothing fails when the API under them changes. An `@example` in a JSDoc block sits beside the code it describes and is reviewed with it; a fenced block in a README, an ARCHITECTURE.md or a guide sits far from it and drifts.

This rule reads every fenced block whose language is TypeScript or JavaScript (`ts`, `typescript`, `tsx`, `mts`, `cts`, `js`, `javascript`, `jsx`, `mjs`, `cjs`), and the inline scripts of every `html` block, in every Markdown file except `CHANGELOG.md`. It parses each and makes two checks. [`jsdoc-example-api`](./jsdoc-example-api.md) makes the first of them on the examples in JSDoc blocks.

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
| Bundle global        | `const { parse } = HyperfrontendVersioning`, `Global.x`  | `parse`, `x`                  |

A default import and the package's `package.json` subpath are not checked. A package the workspace does not publish (`react`, a private project) is not checked either.

A bundle global is the name a package's `iife` or `umd` build assigns itself to, declared as `globalName` in its `project.json`. It is what the script of a CDN snippet reads the package off, so the script of an `html` block is checked the same way a module is; a block that declares a variable of that name itself is left alone.

An example that does not parse, usually a sketch with an elision in it, still has its `import … from` and `export … from` statements read, each on its own. They are whole even when the code around them is not, and they are the part that drifts.

When another entry point of the same package exports the name, the message says which, since the usual cause is a name that moved to a secondary entry point.

### 2. A function an example calls at its top level is provided

In a publishable package's own documentation, a function or constructor an example calls **at its top level** must come from somewhere. It is provided when any of these holds:

- the example declares or imports the name, anywhere in the block;
- it is a language, browser, Node or test-runner global (`parseInt`, `fetch`, `expect`), or an export of a common Node module (`readFileSync`, `join`, `spawn`), which examples about files and processes call without importing;
- an entry point of any workspace package exports it;
- the package's own sources declare it, exported or not, as an ARCHITECTURE.md describing internals needs.

Only top-level calls are checked. What an example runs itself is what it demonstrates; what sits inside a function body is the reader's to supply, a `render(state)` or a `handle(message)` standing in for their own code. Member calls (`store.dispatch()`) are not checked, as the receiver's type is not known.

An example that shows what **not** to write marks it with ❌, on the line of the call or on a comment line above it. The nearest ❌ or ✅ at or above a call speaks for it, so a block may show both.

### What is not checked, and why

Each of these was measured against the workspace's own documentation, 620 Markdown examples and 2,052 JSDoc examples, before it was left out.

| Not checked                             | Candidates found | Real drift among them | Why not                                                           |
| --------------------------------------- | ---------------- | --------------------- | ----------------------------------------------------------------- |
| Calls inside function bodies            | 81               | 0                     | every one was the reader's own handler, renderer or fetch         |
| Top-level calls in JSDoc examples       | 25               | 0                     | an example beside its code shows a setting, which is the reader's |
| Type names nothing declares             | 14               | at most 4             | placeholders such as `User`, and it needs every library type name |
| Constants, members of an imported value | 1                | 0                     | nothing to catch; a member check has no type to go on             |
| Relative imports                        | 35               | 0                     | none names a file that exists: they stand for the reader's files  |
| The rest of a block that does not parse | n/a              | n/a                   | only its module statements are precise enough to read             |

Inline code in prose is the business of [`lib-inline-code-links`](./lib-inline-code-links.md): a name there must link to documentation that resolves.

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

A name a CDN snippet reads off a bundle global:

```html
<script src="https://unpkg.com/@hyperfrontend/random-generator-utils"></script>
<script>
  const { uuid4 } = HyperfrontendRandomGenerator
</script>
<!-- Error: Example takes `uuid4` from `HyperfrontendRandomGenerator`, which exports no `uuid4`. Update the example to the API as it is now. -->
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

- [jsdoc-example-api](./jsdoc-example-api.md) - Makes the same check of the examples in JSDoc blocks
- [lib-inline-code-links](./lib-inline-code-links.md) - Ensures inline code naming an API links to documentation that resolves
- [lib-require-jsdoc-example](./lib-require-jsdoc-example.md) - Ensures every exported function carries an example
