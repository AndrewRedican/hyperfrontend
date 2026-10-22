# @hyperfrontend/lint

The workspace linter. It implements every rule this workspace enables with its own parsers for TypeScript, JavaScript, JSON and Markdown, a project graph computed the way Nx computes it, and no external packages.

## Running it

Each project's Nx `lint` target runs `node <rel>/tools/lint/bin/lint.ts .` from the project root; `npx nx lint:all` runs them all and writes the report. From any directory:

```bash
node tools/lint/bin/lint.ts [--fix | --fix-dry-run] [--format stylish|json] \
  [--max-warnings n] [paths...]
node tools/lint/bin/lint.ts --stdin --stdin-filename src/file.ts < file.ts
```

The exit code is 0 when clean, 1 when problems were reported, and 2 when the command could not run or a file could not be linted.

## Configuration

The linter reads the nearest `lint.config.ts` at or above the directory it runs in: a module whose default export is a list of blocks `{ files, ignores, rules, settings, language }`, globs relative to that file's directory, a later block winning over an earlier one. Every project's file spreads the workspace's base before its own blocks:

```ts
import baseConfig from '../../lint.base.config.ts'

export default [
  ...baseConfig,
  { files: ['**/*.json'], rules: { 'projects/dependency-checks': ['error', { ignoredDependencies: ['@hyperfrontend/testing'] }] } },
]
```

`lint.base.config.ts` at the workspace root lists every rule the workspace enables, from the rule sets in `config/rule-sets.ts`; `config/globals.ts` holds the read-only browser and Node globals JavaScript files see. A rule turned on with options takes only the options the workspace configures.

Comments switch rules off locally: `lint-disable` and `lint-enable` (block comments), `lint-disable-line` and `lint-disable-next-line`, each with optional rule ids and an optional `-- justification` after them. A directive that suppresses nothing is reported, with a fix that removes it.

## Layout

- `bin/lint.ts`: the command.
- `config/`: the rule sets and globals the base configuration is written from.
- `src/cli/`, `src/config/`, `src/engine/`, `src/files/`, `src/output/`: arguments, configuration loading and resolution, directives, the per-file lint loop with up to ten fix passes, file enumeration, and the stylish and JSON formatters.
- `src/languages/`: one adapter per language, picked by extension: code (TypeScript, TSX, JavaScript), JSON, Markdown and plain text (YAML).
- `src/code/`, `src/markdown/`: the parsers, producing ESTree-shaped and mdast-shaped trees with positions.
- `src/scope/`, `src/flow/`, `src/jsdoc/`, `src/regex/`: the semantic services rules share: scope analysis, code paths, JSDoc blocks and type expressions, regular-expression patterns.
- `src/graph/`: the project graph Nx would build: projects, their files and tags, each code file's imports and the edges they draw, cached under `node_modules/.cache/hyperfrontend-lint/`.
- `src/rules/<family>/<rule>.ts`: one file per rule, its spec beside it; helpers a family shares sit in `src/rules/<family>/shared/`.
- `src/nx/plugin.ts`: the Nx plugin inferring each project's `lint` target.
- `docs/rules/`: the documentation of the workspace and project rules, which the lint report links to.
- `scripts/`: development tooling: `parser-oracle.ts` compares the scanner with the installed TypeScript compiler, `graph-oracle.ts` compares the graph with the file `nx graph --file` writes, `bench.ts` times the linter.

## Writing a rule

A rule is `src/rules/<family>/<rule>.ts`, its default export a `defineRule({ id, language, fixable, create })` whose `create` returns listeners by node kind; the id names the file, so nothing registers it. Its spec beside it lists valid and invalid cases with `testRule`. The `lint-rules` skill has the details.

## Commands

```bash
npx nx test tool-lint
npx nx typecheck tool-lint
node tools/lint/scripts/parser-oracle.ts
node tools/lint/scripts/graph-oracle.ts --graph <file written by nx graph --file>
node tools/lint/scripts/bench.ts
```

Many rule specs carry cases adapted from the test suites of the projects whose rules this linter reimplements; `NOTICE.md` and `licenses/` record their origin.
