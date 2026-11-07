# @hyperfrontend/lint

The workspace's lint integration: the workspace's own rule families, and [`@hyperfrontend/linter`](../../libs/linter/README.md) run from its TypeScript source.

## Running it

Every project but the workspace root gets a `lint` target, inferred by the workspace graph, that runs the `lint.command` of `hf.json` from the project root, here `node <rel>/tools/lint/bin/lint.ts .`; projects under the `lint.exclude` globs of `hf.json` get none. `npx hf run hyperfrontend:lint:all` runs them all and writes the report. From any directory:

```bash
node tools/lint/bin/lint.ts [--fix | --fix-dry-run] [--format stylish|json] \
  [--max-warnings n] [paths...]
node tools/lint/bin/lint.ts --stdin --stdin-filename src/file.ts < file.ts
```

`bin/lint.ts` installs the resolution hook of `@hyperfrontend/workspace` (`libs/workspace/src/hooks/index.ts`) and then calls the package's `run`, so the package and the libraries it bundles load from source: a fresh checkout lints without a build or a published linter. The flags, the exit codes and the configuration are the package's; its [README](../../libs/linter/README.md) and the [rule catalogue](https://www.hyperfrontend.dev/docs/libraries/linter/rules/) describe them.

## Configuration

Every project's `lint.config.ts` spreads the root `lint.base.config.ts` before its own blocks. The base registers the families from `config/families.ts`: the workspace's own `workspace/` rules, and the `projects/` family `@hyperfrontend/workspace/lint` publishes. It builds its blocks from the package's presets, and adds the workspace's settings from `config/rule-sets.ts`: where documentation comments are required and the tag constraints of the project graph.

## The workspace's rules

| Family        | What it checks                                                                                                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workspace/*` | This repository's conventions: library manifests and READMEs, the docs site's registrations, CI workflows, the portable-path helpers, logging and editor policy                              |
| `projects/*`  | Module boundaries, declared dependencies and portable command lines, on the workspace graph; published by `@hyperfrontend/workspace/lint`, documented in `libs/workspace/src/lint/README.md` |

A workspace rule is `src/rules/workspace/<rule>.ts`, its default export a `defineRule` from `@hyperfrontend/linter`; the id names the file, and `config/families.ts` registers every file it finds. The readers the rules share with the published family (the workspace root and project of a file, project files, aliases, module exports) come from `@hyperfrontend/workspace/lint`. Its spec beside it lists valid and invalid cases with `testRule` from `@hyperfrontend/linter/testing`. The rules import only the package's public entries. Their documentation is in `docs/rules/`, and the `lint-rules` skill has the details.

## Layout

- `bin/lint.ts`: the command.
- `config/`: the families and the workspace's own settings.
- `src/rules/workspace/`: the workspace's rules, with specs and fixtures.
- `scripts/`: development tooling: `parser-oracle.ts` compares the package's scanner with the installed TypeScript compiler, `bench.ts` times the linter.

## Commands

```bash
npx hf run tool-lint:test
npx hf run tool-lint:typecheck
node tools/lint/scripts/parser-oracle.ts
node tools/lint/scripts/bench.ts
```

The `projects` family's specs carry cases adapted from Nx's test suites; `NOTICE.md` and `licenses/` record their origin.
