---
name: lint-rules
description: Create lint rules for the hyperfrontend monorepo, in the @hyperfrontend/linter package (libs/linter) or the workspace's own families (tools/lint). Use when adding a lint rule, changing an existing rule's behaviour or autofix, writing rule docs or specs, or switching a rule on in a lint config.
---

# Lint Rules Skill

The engine and every generally useful rule are the publishable package `@hyperfrontend/linter` (`libs/linter`, Nx `lib-linter`): its own parsers, no external packages. The workspace's own rules (`workspace/*`, `projects/*`) and the project graph live in `tools/lint` (Nx `tool-lint`), which runs the package from source. A rule is one file and one spec. REUSE the shared helpers and services. Follow the existing rules.

**Where a rule goes.** A rule any project could use belongs in the package: a bare id for a core rule or a convention, or a family prefix (`typescript/`, `jsdoc/`, `react/`, `react-hooks/`, `package-json/`). A rule that enforces this repository's layout, names or release practice is a `workspace/` rule; one that reads the project graph is a `projects/` rule. A packaged rule takes a repository's specifics as options, set in `lint.base.config.ts`, never as defaults.

## Reference Locations

| What                | Where                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| Packaged rules      | `libs/linter/src/rules/<family>/<name>.ts`; bare ids under `javascript/` (core) and `conventions/`          |
| Packaged rule list  | `libs/linter/src/rules/catalogue.ts` and `ids.ts`: add the rule to both, alphabetically                     |
| Packaged rule docs  | `libs/linter/docs/rules/<id>.md` (the id's slash is a directory); required for every packaged rule          |
| Workspace rules     | `tools/lint/src/rules/workspace/<name>.ts`, `tools/lint/src/rules/projects/<name>.ts`; found by file name   |
| Workspace rule docs | `tools/lint/docs/rules/<name>.md`                                                                           |
| Rule API            | `@hyperfrontend/linter` (`defineRule`, the node and report types)                                           |
| Helpers             | `@hyperfrontend/linter/helpers`; inside the package, `libs/linter/src/rules/shared/` and `<family>/shared/` |
| Spec helper         | `@hyperfrontend/linter/testing` (`testRule`)                                                                |
| Presets             | `libs/linter/src/presets/rule-sets.ts`; the workspace's settings in `tools/lint/config/rule-sets.ts`        |
| Base config         | `lint.base.config.ts`; per project `<project>/lint.config.ts`                                               |

**Before creating a rule:** read `libs/linter/docs/rules/` and `tools/lint/docs/rules/` to check for an existing rule. Do not duplicate.

A workspace rule needs no registration: `tools/lint/config/families.ts` registers every file in its family's directory, and the id names the file (`workspace/lib-pkg-fields` is `src/rules/workspace/lib-pkg-fields.ts`). A workspace rule imports only `@hyperfrontend/linter`, `/helpers` and `/testing`, never the package's source files. A rule runs once a config block switches it on.

---

## Rule Categories

- **`lib-*`** (workspace): publishable library enforcement (package.json, project.json, README). Guard with `isInPublishableProject()` or build on `manifestRule()`.
- **`no-*`**: prohibitions (enums, unsafe patterns, async fs).
- **`prefer-*`**: style preferences with autofixes.
- **`require-*`**: mandate presence (`node:` protocol).
- **Workspace**: cross-project validation (docs-site, root README).

---

## The Rule Shape

```typescript
/**
 * No `enum` declarations: a frozen const object says the same thing and tree-shakes.
 *
 * @module rules/conventions/no-enum
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'

export default defineRule<undefined, Node>({
  id: 'no-enum',
  language: 'code',
  fixable: false,
  create(context) {
    return {
      TSEnumDeclaration(node) {
        context.report({ start: node.start, end: node.end, message: "The 'enum' keyword is not allowed." })
      },
    }
  },
})
```

- `language` is `code` (TypeScript, TSX, JavaScript), `json`, `markdown` or `text` (YAML and other line-based files). The engine picks the language from the extension.
- Listeners are keyed by node kind: ESTree kinds for code (`CallExpression`, `TSEnumDeclaration`, `Program`), `document`, `object`, `property`, `string`... for JSON, the Markdown kinds of `src/markdown/model.ts`. `Kind:exit` runs on the way out.
- `context.file` has `path`, `text`, `lines` and `comments`; `context.options` is the configured options (type the first generic); `context.settings` and `context.language` come from the matching blocks.
- `context.report({ start, end, message, fix })` takes offsets. `fix` is `{ start, end, text }`; set `fixable: true` when the rule fixes. A rule that names a position outright (Markdown) passes `at: { line, column }`.
- Inside the package, imports are extensionless relative paths; in `tools/lint`, they keep the `.ts` extension. A workspace rule imports types and `defineRule` from `@hyperfrontend/linter`.
- Implement only the options a configuration sets, and document them. Message texts are behaviour: never reword one without updating every spec and doc that quotes it.

### Services

| Need                            | Call                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| Scopes, variables, references   | `scopeAnalysisOf(context)`, `scopeOf` (`/helpers`; `libs/linter/src/scope/analysis.ts`) |
| Code paths                      | `flowAnalysisOf(context)` (`libs/linter/src/flow/analysis.ts`, packaged rules only)     |
| Project graph (as Nx builds it) | `workspaceGraph(root)` (`tools/lint/src/graph/build.ts`, workspace rules only)          |
| Regular expression structure    | `parse`, `validate` (`libs/linter/src/regex/`, packaged rules only)                     |
| JSDoc blocks and types          | `libs/linter/src/jsdoc/` (`parse.ts`, `attach.ts`, `types.ts`, packaged rules only)     |

Each is computed once per file or process and shared by every rule.

### Shared helpers: MUST REUSE

| Module                                                   | Gives                                                                                                                                           |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `@hyperfrontend/linter/helpers`                          | JSON (`propertyOf`, `rootObject`, `isString`, `stringsUnder`, `wholeDocument`, `indentationAt`), tokens, scopes, `mergeEdits`, globs, positions |
| `libs/linter/src/rules/conventions/shared/`              | `sources.ts`, `comments.ts`, `tests.ts`, `ordering.ts`, `star-height.ts` (packaged rules)                                                       |
| `tools/lint/src/rules/workspace/shared/locate.ts`        | `workspaceRootOf`, `projectRootOf`, `isInPublishableProject`, `isAtWorkspaceRoot`                                                               |
| `tools/lint/src/rules/workspace/shared/project-file.ts`  | `readProjectFile`, `readPackageFile`, `isPublishableLibrary`                                                                                    |
| `tools/lint/src/rules/workspace/shared/manifest-rule.ts` | `manifestRule`: the frame of every publishable-library manifest rule                                                                            |
| `tools/lint/src/rules/workspace/shared/libraries.ts`     | `publishableLibraries`                                                                                                                          |
| `tools/lint/src/rules/workspace/shared/sources.ts`       | The ordering helpers with the workspace's scope, for `cross-platform` and the barrel rules                                                      |
| `tools/lint/src/rules/workspace/shared/aliases.ts`       | `pathAliases` (the `tsconfig.base.json` paths)                                                                                                  |
| `tools/lint/src/rules/workspace/shared/exports-index.ts` | `parsedModule`, `resolveModule`, `moduleExports`                                                                                                |
| `tools/lint/src/rules/workspace/shared/readme.ts`        | `badgeBlock`, `shortDescription`                                                                                                                |

### File I/O and strings

- **Sync only**: `readFileSync`, `writeFileSync`, `existsSync`; never `node:fs/promises`.
- Imports: `node:*`, `@hyperfrontend/*` and relative only; built-ins through `@hyperfrontend/immutable-api-utils/built-in-copy/*`.
- **Avoid regex** where `startsWith()`, `endsWith()`, `includes()` or `split()` say it plainly.

---

## Testing: `testRule` on `@hyperfrontend/testing`

```typescript
import { testRule } from '../../testing/rule-tester'
import rule from './no-enum'

testRule(rule, {
  valid: [{ name: 'a frozen object', path: '/root/a.ts', text: 'export const A = 1\n' }],
  invalid: [
    {
      name: 'an enum',
      path: '/root/a.ts',
      text: 'enum A { B }\n',
      errors: [{ message: "The 'enum' keyword is not allowed.", line: 1, column: 1, endLine: 1, endColumn: 13 }],
    },
  ],
})
```

- Each case is one test: `valid` must report nothing; `invalid` lists every message in position order and, for a fixing rule, the `output` after fixes. Cases take `options`, `settings`, `language` and `root` like a config block.
- Compute positions from the case's own text (`text.indexOf(needle) + 1`), never by counting lines by hand.
- Rules that read the workspace use a disposable workspace written into the temporary directory from a `__test-utils__` module (for instance `createLibraryWorkspace()`), created at module level and removed by a final `it('removes the disposable workspace', …)`; `afterAll` is not available. Never keep test material as files at rest: `workspace/no-test-fixtures` reports fixture directories and any non-code file under `__test-utils__`.
- Test names are assertive: `reports X`, `allows Y`, never `should …`.
- A workspace rule's spec imports `testRule` from `@hyperfrontend/linter/testing`.
- 100 % lines, branches and functions, measured by `npx nx test lib-linter` for packaged rules and `npx nx test tool-lint` for workspace rules. One spec alone: see the single-spec recipe in memory (`node --import libs/testing/src/hooks/index.ts --test --experimental-test-coverage …` from the project root). Uncoverable branches: the `lint-coverage` skill.

---

## Checklist

- [ ] In the package or the workspace by the rule above; `rules/<family>/<name>.ts` with a module header and `defineRule`; JSDoc on every function, with an `@example` in the package
- [ ] A packaged rule added to `catalogue.ts` and `ids.ts`, with no repository specifics in its defaults
- [ ] Only the configured options; guard `lib-*` rules to publishable libraries
- [ ] Shared helpers and services reused, nothing reimplemented
- [ ] Spec beside it: assertive names, positions computed, 100 % coverage
- [ ] Doc in `libs/linter/docs/rules/<id>.md` for a packaged rule, `tools/lint/docs/rules/<name>.md` for a `workspace/` or `projects/` rule
- [ ] Switched on in `lint.base.config.ts` or the project's `lint.config.ts`
- [ ] `node tools/lint/bin/lint.ts .` from the project root still reports nothing
