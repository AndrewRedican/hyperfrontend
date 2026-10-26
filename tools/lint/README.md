# @hyperfrontend/lint

The workspace's lint integration: [`@hyperfrontend/linter`](../../libs/linter/README.md) run from its TypeScript source, the workspace's own rule families, the project graph those rules read, and the Nx plugin that gives every project a `lint` target.

## Running it

Each project's Nx `lint` target runs `node <rel>/tools/lint/bin/lint.ts .` from the project root; `npx nx lint:all` runs them all and writes the report. From any directory:

```bash
node tools/lint/bin/lint.ts [--fix | --fix-dry-run] [--format stylish|json] \
  [--max-warnings n] [paths...]
node tools/lint/bin/lint.ts --stdin --stdin-filename src/file.ts < file.ts
```

`bin/lint.ts` installs the resolution hook in `src/runtime/aliases.ts` and then calls the package's `run`, so the package and the libraries it bundles load from source: a fresh checkout lints without a build or a published linter. The flags, the exit codes and the configuration are the package's; its [README](../../libs/linter/README.md) and the [rule catalogue](https://www.hyperfrontend.dev/docs/libraries/linter/rules/) describe them.

## Configuration

Every project's `lint.config.ts` spreads the root `lint.base.config.ts` before its own blocks. The base registers the workspace's families from `config/families.ts`, builds its blocks from the package's presets, and adds the workspace's settings from `config/rule-sets.ts`: where documentation comments are required and the tag constraints of the project graph.

## The workspace's rules

| Family        | What it checks                                                                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workspace/*` | This repository's conventions: library manifests and READMEs, the docs site's registrations, CI workflows, the portable-path helpers, logging and editor policy |
| `projects/*`  | Module boundaries, declared dependencies and Nx plugin manifests, on the project graph in `src/graph/`                                                          |

A rule is `src/rules/<family>/<rule>.ts`, its default export a `defineRule` from `@hyperfrontend/linter`; the id names the file, and `config/families.ts` registers every file it finds. Its spec beside it lists valid and invalid cases with `testRule` from `@hyperfrontend/linter/testing`. The rules import only the package's public entries. Their documentation is in `docs/rules/`, and the `lint-rules` skill has the details.

## Layout

- `bin/lint.ts`: the command.
- `config/`: the families and the workspace's own settings.
- `src/runtime/aliases.ts`: the resolution hook that loads workspace libraries from source.
- `src/rules/workspace/`, `src/rules/projects/`: the workspace's rules, with specs and fixtures.
- `src/nx/plugin.ts`: the Nx plugin inferring each project's `lint` target.
- `scripts/`: development tooling: `parser-oracle.ts` compares the package's scanner with the installed TypeScript compiler, `graph-oracle.ts` compares the workspace graph of `@hyperfrontend/workspace/graph` (`tools/workspace/src/graph/`) with the file `nx graph --file` writes, `bench.ts` times the linter.

## Commands

```bash
npx nx test tool-lint
npx nx typecheck tool-lint
node tools/lint/scripts/parser-oracle.ts
node tools/lint/scripts/graph-oracle.ts --graph <file written by nx graph --file>
node tools/lint/scripts/bench.ts
```

The `projects` family's specs carry cases adapted from Nx's test suites; `NOTICE.md` and `licenses/` record their origin.
