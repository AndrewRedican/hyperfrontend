---
name: lint-rules
description: Create custom lint rules for the hyperfrontend Nx monorepo's workspace linter in tools/lint. Use when adding a lint rule, changing an existing rule's behaviour or autofix, writing rule docs or specs, or switching a rule on in a lint config.
---

# Lint Rules Skill

The linter is `tools/lint` (Nx project `tool-lint`): its own parsers, no external packages. A rule is one file and one spec. REUSE the shared helpers and services. Follow the existing rules.

## Reference Locations

| What               | Where                                                                    |
| ------------------ | ------------------------------------------------------------------------ |
| Rules              | `tools/lint/src/rules/<family>/<name>.ts` (`workspace/` for our own)     |
| Rule documentation | `tools/lint/docs/rules/<name>.md` (workspace and projects rules)         |
| Shared helpers     | `tools/lint/src/rules/shared/`, `tools/lint/src/rules/workspace/shared/` |
| Rule API           | `tools/lint/src/engine/rule.ts`                                          |
| Spec helper        | `tools/lint/src/testing/rule-tester.ts`                                  |
| Rule sets          | `tools/lint/config/rule-sets.ts`                                         |
| Base config        | `lint.base.config.ts`; per project `<project>/lint.config.ts`            |

**Before creating a rule:** read `tools/lint/docs/rules/` to check for an existing rule. Do not duplicate.

There is no registry to edit: the id names the file (`workspace/no-enum` is `src/rules/workspace/no-enum.ts`; a core rule's bare id lives under `src/rules/javascript/`). A rule runs once a config block switches it on.

---

## Rule Categories

- **`lib-*`**: publishable library enforcement (package.json, project.json, README). Guard with `isInPublishableProject()` or build on `manifestRule()`.
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
 * @module rules/workspace/no-enum
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'

export default defineRule<undefined, Node>({
  id: 'workspace/no-enum',
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
- Implement only the options the workspace configures. Message texts are behaviour: never reword one without updating every spec and doc that quotes it.

### Services

| Need                            | Call                                                            |
| ------------------------------- | --------------------------------------------------------------- |
| Scopes, variables, references   | `scopeAnalysisOf(context)`, `scopeOf` (`src/scope/analysis.ts`) |
| Code paths                      | `flowAnalysisOf(context)` (`src/flow/analysis.ts`)              |
| Project graph (as Nx builds it) | `workspaceGraph(root)` (`src/graph/build.ts`)                   |
| Regular expression structure    | `parse`, `validate` (`src/regex/`)                              |
| JSDoc blocks and types          | `src/jsdoc/` (`parse.ts`, `attach.ts`, `types.ts`)              |

Each is computed once per file or process and shared by every rule.

### Shared helpers: MUST REUSE

| Module (`src/rules/…`)              | Gives                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `shared/json.ts`                    | `propertyOf`, `rootObject`, `isString`, `stringsUnder`, `wholeDocument`, `indentationAt` |
| `workspace/shared/locate.ts`        | `workspaceRootOf`, `projectRootOf`, `isInPublishableProject`, `isAtWorkspaceRoot`        |
| `workspace/shared/project-file.ts`  | `readProjectFile`, `readPackageFile`, `isPublishableLibrary`                             |
| `workspace/shared/manifest-rule.ts` | `manifestRule`: the frame of every publishable-library manifest rule                     |
| `workspace/shared/libraries.ts`     | `publishableLibraries`                                                                   |
| `workspace/shared/sources.ts`       | `sourceCategory`, `isBuiltinModule`, `compareSources`, `relativeDepth`                   |
| `workspace/shared/comments.ts`      | `commentKind`, `isLineComment`, `isJsdocComment`                                         |
| `workspace/shared/tests.ts`         | `testDeclaration`, `suiteDeclaration`                                                    |
| `workspace/shared/ordering.ts`      | `isContiguous`, `rewriteRun`, `checkModuleOrder`                                         |
| `workspace/shared/aliases.ts`       | `pathAliases` (the `tsconfig.base.json` paths)                                           |
| `workspace/shared/exports-index.ts` | `parsedModule`, `resolveModule`, `moduleExports`                                         |
| `workspace/shared/readme.ts`        | `badgeBlock`, `shortDescription`                                                         |

### File I/O and strings

- **Sync only**: `readFileSync`, `writeFileSync`, `existsSync`; never `node:fs/promises`.
- Imports: `node:*`, `@hyperfrontend/*` and relative only; built-ins through `@hyperfrontend/immutable-api-utils/built-in-copy/*`.
- **Avoid regex** where `startsWith()`, `endsWith()`, `includes()` or `split()` say it plainly.

---

## Testing: `testRule` on `@hyperfrontend/testing`

```typescript
import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-enum.ts'

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
- Rules that read the workspace use a disposable fixture workspace under `__fixtures__/` (for instance `createLibraryWorkspace()`), created at module level and removed by a final `it('removes the disposable workspace', …)`; `afterAll` is not available.
- Test names are assertive: `reports X`, `allows Y`, never `should …`.
- 100 % lines, branches and functions, measured by `npx nx test tool-lint`. One spec alone: see the single-spec recipe in memory (`node --import libs/testing/src/hooks/index.ts --test --experimental-test-coverage …` from `tools/lint`). Uncoverable branches: the `lint-coverage` skill.

---

## Checklist

- [ ] `src/rules/<family>/<name>.ts` with a module header and `defineRule`; JSDoc on every function
- [ ] Only the configured options; guard `lib-*` rules to publishable libraries
- [ ] Shared helpers and services reused, nothing reimplemented
- [ ] Spec beside it: assertive names, positions computed, 100 % coverage
- [ ] Doc in `tools/lint/docs/rules/<name>.md` for a `workspace/` or `projects/` rule
- [ ] Switched on in `lint.base.config.ts` or the project's `lint.config.ts`
- [ ] `node tools/lint/bin/lint.ts .` from the project root still reports nothing
