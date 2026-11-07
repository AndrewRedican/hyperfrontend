# @hyperfrontend/workspace

Workspace graph, task runner and generators behind the hf command line.

## Command line

`src/cli/run.ts` is the workspace's command line, behind `npx hf <command>`: `bin/hf.mjs` installs the resolution hook of `src/hooks/` and runs it. It runs every task the way the pipeline does: no cache, nothing restored.

```bash
npx hf run lib-logging:test
npx hf run lib-logging:publish --dryRun
npx hf run-many -t build -p docs-site
npx hf run-many -t test,typecheck -p 'lib-*,tool-*'
npx hf affected -t test --base=origin/main
npx hf format --check
npx hf format --write --files=README.md,CONTRIBUTING.md
npx hf generate library --name=my-utils --type=util --dry-run
npx hf show projects --with-target=publish
npx hf graph explain lib-logging
```

| Command                                               | What it does                                                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `run <project>:<target> [--name=value ...]`           | Runs that one task alone, without the tasks it depends on                                                  |
| `run-many -t <targets> (-p <names> \| --all)`         | Runs the tasks and their `dependsOn` prerequisites in order, skipping the dependents of a failure          |
| `affected -t <targets> [--base=<ref>] [--head=<ref>]` | Runs the tasks the owned selection picks for the change, from the merge base with `origin/main` by default |
| `format --check\|--write [--all \| --files=<list>]`   | Runs prettier on the changed files, every file, or the files named                                         |
| `generate <generator> [--option=value ...]`           | Runs a generator, named `<name>` or `<package>:<name>`: `library`, `make-publishable`, `rename`, `move`    |
| `show projects [--with-target=<target>] [--json]`     | Lists the project names                                                                                    |
| `graph <command>`                                     | The graph commands of `src/cli/graph.ts`, described under [Workspace graph](#workspace-graph)              |

The root project's targets are named through its project name, `hyperfrontend:lint:all`. `-p` takes names and `*` globs, comma-separated.

`run` finds the workspace root from any directory below it, merges the target of the project's `project.json` with `hf.json`'s `targetDefaults`, and runs exactly that task: nothing the task depends on runs first, and nothing is cached or restored. An `@hyperfrontend/workspace:run-commands` target runs its commands through the platform shell, with `node_modules/.bin` on the path. Any other target names an executor as `<package>:<name>`. The package is the workspace project whose `package.json` carries that name (`@hyperfrontend/package`, `@hyperfrontend/app` or `@hyperfrontend/workspace` here), else the package of that name installed in `node_modules`. Its `package.json` names an `executors.json`, which names the module, with or without its extension. The module is called in the same process, with the defaults of its schema and an executor context built from the discovered projects. `--name=value` after the task sets an option, read as the type the executor's schema declares, and `--name` alone sets it to `true`; after a run-commands target the arguments reach the command. Configurations are refused. Its own messages go to standard error; it exits 0 when the task succeeded and 1 otherwise.

`generate` takes a bare name from the workspace projects that declare a `generators.json`, so a workspace's own generator stands in front of a packaged one of the same name, then from `@hyperfrontend/workspace` itself; two workspace projects offering the same name are refused until the package is named. It is the one command that runs where no `hf.json` exists yet, taking the working directory as the root.

`run-many` and `affected` start each task as a child of the command line that is running: the same Node.js, flags and entry.

The `hf` name is shared with `@hyperfrontend/features`, which publishes an `hf` executable of its own (`init`, `build`, `dev`, `serve`), and npm links only one of the two. A first word that is none of the commands above is passed to the features command line when that package is installed where the command was run, and `--help` prints both usages; without it, the word is reported as unknown. The features executable does the same in the other direction, so both answer alike whichever was linked.

## Workspace graph

`src/graph/`, exported as `@hyperfrontend/workspace/graph`, builds the owned dependency graph: what the workspace is made of and how its parts depend on one another, qualified more finely than a project-level graph can be. `workspaceGraph(root)` builds it once per process from the files git tracks or would track (less `.hfignore`), the `project.json` and `package.json` files among them, `tsconfig.base.json`, `hf.json` and `package-lock.json`. Nothing under the directory imports Nx; a spec reads every import under it and fails on `nx`, `@nx/*` or the Nx-facing adapters. The lint rules of the `projects` family read the graph, and the `version-batch` executor maps changed files to versionable projects through it.

| Node kind  | Identity                                     | Read from                                                    |
| ---------- | -------------------------------------------- | ------------------------------------------------------------ |
| `project`  | the Nx project name                          | `project.json`, or a lone `package.json`                     |
| `file`     | workspace-relative POSIX path, with its role | `git ls-files`                                               |
| `entry`    | `<package>` or `<package>/<subpath>`         | `package.json#exports`, cross-checked with the aliases       |
| `external` | `<name>@<version>`                           | `package-lock.json`                                          |
| `tool`     | the executor a target runs                   | `project.json` targets, `hf.json` defaults, `executors.json` |
| `config`   | a configuration file or glob a target reads  | target inputs after the named inputs expand                  |
| `task`     | `<project>:<target>`                         | targets after the defaults merge                             |

The graph carries two views of the same imports. `edges` holds the project edges as Nx draws them (`static`, `dynamic`, `implicit`). `records` holds every qualified edge in canonical order: from a file to the file, entry or installed package it imports, or from a project to the projects it declares, the packages its manifest depends on, the tools its targets run and the configuration its inputs name. Each record carries its `kind` (`value`, `type`, `side-effect`, `re-export-all`, `dynamic`, `unresolved`, `manifest`, `declared`, `tool`, `config`), the `role` of the file that drew it, the specifier and what it resolved to, the targets it is relevant to, and its evidence: a source position or a configuration key. `groups` collects the records between a project and each node outside it by kind and role, so an import from a spec is visible as such rather than collapsed into one project dependency.

The role comes from `roles.ts`: `production`, `spec`, `test-config`, `lint-config`, `build-config`, `script`, `docs` or `asset`, derived from the exclusions of the `production` named input in `hf.json` plus fixed patterns (`__test-utils__/`, `scripts/`, configuration basenames). The module lists the exclusions it implements, and a spec compares that list with `hf.json`, so an exclusion added there without a matching rule here fails the suite instead of being treated as production.

Imports are read with the linter's parser under Nx's rules, so a `require` inside a function or an `import()` counts as dynamic exactly when Nx counts it so, and each import records its form, whether it brings in types alone, the names it imports and its position. They are remembered in `node_modules/.cache/hyperfrontend-lint/imports.json`: a file whose size and modification time are unchanged is not read again, and one whose content hash is unchanged is not parsed again. The cache names the reader that wrote it, a hash of the parser's sources where the workspace aliases the parser package to its source, so a parser change invalidates it.

```bash
npx hf graph projects
npx hf graph graph --json
npx hf graph explain lib-logging
npx hf graph explain lib-logging
```

`projects` lists every project with its type, root and tags; `graph` prints the node and edge counts, or with `--json` the projects, nodes and records; `explain <project>` prints the groups a project draws and the groups drawn to it, one line per kind and role with the files behind it; `explain <project:target>`, `build`, `verify`, `status` and `affected` are described below.

`sortEdges` puts edges in one canonical order, so a graph serialises to the same bytes whatever order their edges were found in. `selection.ts` holds the records the affected analysis produces: every decision carries a `Reason` whose `rule` is one of a closed set, so an explanation can always name the rule that fired.

A load whose specifier is an expression (`import(name)`, `require(path)`, `createRequire(...)(x)`) is kept as an `unresolved` import whose text is the expression, and a file the parser cannot read draws one `unresolved` edge to its own project with no specifier at all. Both make the analysis below treat the project as reachable whole, which is the conservative answer when the graph cannot say what a file reaches.

### Persisted state

`src/graph/store/` keeps the graph under `.hf/graph/` (ignored by git and prettier) as five files, each an envelope of `{ body, digest, schema }` in canonical JSON: `files.json` (every file with the blob id git computes for it, so a checkout's line-ending filters apply as they apply to the index), `imports.json` (the imports of each code file keyed by that hash, `null` for a file that does not parse), `graph.json` (projects, nodes, records and the Nx project edges), `entries.json` (the files each entry can reach and a digest of their content) and `meta.json` (the schema, a hash of the graph sources, the import reader, the Node major and the hash of each global configuration file). `buildState` runs under a lock file holding the writer's pid, stale once the pid is dead or after a minute, reads what is persisted, reparses only the code files whose hash changed, rebuilds the graph in memory and rewrites only the files whose bytes differ, so two consecutive builds leave every modification time alone. A change to `hf.json`, the root `package.json`, the lock file or `tsconfig.base.json`, or to the graph sources or the parser, rebuilds cold; a corrupted or foreign file reads as absent and rebuilds cold as well. Two checkouts of the same commit write byte-identical files, on Linux and Windows alike, and the state directory never lists itself.

```bash
npx hf graph build
npx hf graph build --force
npx hf graph verify
npx hf graph status --json
```

`build` updates the state incrementally and `--force` builds it cold; `verify` compares a cold rebuild byte for byte and exits 1 on drift; `status` prints what is persisted and what a build would do.

The `plan` job of both pipeline workflows builds the state cold, since nothing is cached between runs, and uploads `graph.json` beside the plan; the Windows and macOS legs build the state cold as well and fail if their `graph.json` digest differs from the Linux one.

### Affected analysis

`src/graph/affected/` decides, for every task of a target, whether a change set selects it, and writes the reason either way. `changes.ts` reads the change set from git: from the merge base of two revisions to the head, or to the working tree with its dirty and untracked files, renames detected. A task is selected by a changed file among its own inputs, by a changed file of another project its closure reaches, by a changed implementation of a tool it runs, by a changed manifest or a deleted or added configuration of a project it depends on, by a global configuration file, or because a task it runs after (`dependsOn`) is selected. The closure of a task starts from its own files and follows the file edges of the kinds the target cares about through entries into other projects; what the graph cannot follow precisely it counts whole, and says so: a project whose reachable file loads a module it cannot name, a project whose production file does not parse, the owner of a dangling import (reported as a deleted or renamed module when the change set deleted or renamed the target), a project re-exported whole with `export *`, every member of a cross-project cycle, every implicit dependency of a project entered, and the targets of the side-effect imports of any project entered, whichever entry was consumed.

Two rules go beyond what the inputs in `hf.json` say. A `type`-only import does not reach `test` or `lint`, which strip types before running. And `build` reaches its dependencies from its production files alone, since its artifact derives from nothing else; every other target reaches them from every own file it reads, so a spec importing `@hyperfrontend/testing` carries the dependency into `test` and `typecheck` but not into `build`. Both are the first rules to revisit if a CI run shows a task skipped that should have run.

Every skipped task carries a reason as well: `unreachable` (naming the kinds and roles through which the task's project depends on the changed one, when it does), `kind-irrelevant` (reachable only through type-only imports), or `role-irrelevant` (a spec or configuration file the target's inputs leave out). The fallbacks that fired are listed once each. A `dependsOn` on another target decides that target as well, and the selection of a target runs to a fixed point so a dependency on the same target is honoured.

```bash
npx hf graph affected --target build --base main
npx hf graph affected --target build --base main --explain
npx hf graph affected --target test \
  --base origin/main --head HEAD --json
npx hf graph explain lib-logging:build --base main
```

The first form prints the selected task ids alone; `--explain` adds every reason, the skipped tasks and the fallbacks; `--json` prints the affected set itself.

The graph is built from the working tree whatever `--head` names, so the analysis of a historical range is exact only when the working tree is that head. Handing the analysis the graph at the base as well (`selectAffected({ previous })`) lets a deleted or renamed module name the tasks it reached before the change even where no import dangles; the command line does not do that yet.

## Executors

A target names one as `@hyperfrontend/workspace:<name>`; `run-commands` is the engine's own and the rest live under `src/executors/`.

| Executor        | Description                                                            | Docs                                              |
| --------------- | ---------------------------------------------------------------------- | ------------------------------------------------- |
| `run-commands`  | Runs shell commands; the short form is a target's bare `command`       | [Command line](#command-line)                     |
| `build`         | Builds a library into a publishable package                            | [README](./src/executors/build/README.md)         |
| `typecheck`     | TypeScript type checking without emitting files                        | -                                                 |
| `test`          | Runs a project's suites on Node's test runner through the test runtime | -                                                 |
| `e2e`           | Tests a package's build through `npm pack` and a tarball install       | -                                                 |
| `publish`       | Publishes to npm, with a dry run                                       | [README](./src/executors/publish/README.md)       |
| `version`       | Versions a project from its conventional commits and commits the bump  | [README](./src/executors/version/README.md)       |
| `version-batch` | Versions every library a change makes due a release, in one commit     | [README](./src/executors/version/README.md)       |
| `version-check` | Compares a project's version state with what its commits call for      | [README](./src/executors/version-check/README.md) |

### typecheck

Runs `tsc --noEmit` against the library's `tsconfig.lib.json` and, when the project has one, its `tsconfig.spec.json`. Specs run with their types stripped, so this is the only step that type checks them. Zero configuration needed; `tsConfig` and `specTsConfig` override either path.

### test

Runs a project's `test.config.ts` on Node's built-in test runner. The executor starts a Node process with the `@hyperfrontend/testing` preload and the runner of `src/executors/test`, which loads the configuration and hands it to the runtime's runner, then prints the coverage table and the reasons a run failed. The runtime is located through the `@hyperfrontend/testing/*` aliases in `tsconfig.base.json`, so the workspace tests every project, the runtime included, on the library's own source, the same way it builds with `@hyperfrontend/builder` from source.

**Options:**

| Option              | Description                                                               |
| ------------------- | ------------------------------------------------------------------------- |
| `testConfig`        | Path to the project's test configuration (defaults to `test.config.ts`)   |
| `coverageDirectory` | Where coverage reports are written (defaults to `coverage/{projectRoot}`) |

### e2e

End-to-end testing for package build outputs. Validates that built packages install and work correctly:

1. Runs `npm pack` in the dist directory to create a tarball
2. Installs the tarball in the E2E test project
3. Runs each configured format on the node test runner (`cjs`, `esm`, `browser`, and the suites the project declares itself), handing the suites the tarball's path as `HF_E2E_TARBALL` so they can install it into an isolated consumer through `@hyperfrontend/testing/consumer`
4. Cleans up tarball after testing

**Options:**

| Option           | Description                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `packageDir`     | Path to built package directory (defaults to the build output of the library the project implicitly depends on)           |
| `testDir`        | Path to E2E test project directory                                                                                        |
| `formats`        | What to test: `cjs`, `esm`, `browser`, or `{ name, specs, timeoutMs?, dom?, serialOn? }` for a suite of the project's own |
| `skipInstall`    | Skip npm pack and install step                                                                                            |
| `cleanupTarball` | Remove tarball after installation (default: true)                                                                         |

### publish

Publishes built packages to npm with:

- `--dry-run` mode for testing
- Automatic access control based on package scope
- Idempotent — skips if version already exists on npm
- Reads credentials from `NPM_TOKEN` environment variable

**Full documentation:** [src/executors/publish/README.md](./src/executors/publish/README.md)

### version, version-batch and version-check

`version` runs the conventional flow of `@hyperfrontend/versioning` on one project, with the npm registry as the source of truth for what is published: it bumps the manifest, writes the changelog entry, brings every workspace project that pins the package to the new version, and commits. A library is also due a release when the graph selects its build for a change to code it ships or to the toolchain the `build` target declares as inputs. `version-batch` finds the libraries a change between `base` and `head` makes due a release, versions each, and records the bumps in one commit; it stands down on the base branch itself. `version-check` is the read-only half: it computes the state the commits call for and compares it with the manifest and changelog on disk, for CI. The conventions the flow assumes are the ones this repository uses: commit scopes name projects, tags are `{projectName}@<version>`, and the batch commit is `chore: update versions for <projects>`.

An executor that wraps `version` or `version-batch` passes `followUps`: functions called after each bump and before the commit, each answering the workspace-relative files it changed, which the commit then carries. This repository's `@hyperfrontend/package:version` adds the root compatibility document that way.

**Full documentation:** [src/executors/version/README.md](./src/executors/version/README.md) | [src/executors/version-check/README.md](./src/executors/version-check/README.md)

## Lint rules

`src/lint/`, exported as `@hyperfrontend/workspace/lint`, holds the `projects` rule family: `module-boundaries`, `dependency-checks` and `command-lines`, rules for `@hyperfrontend/linter` that read the workspace graph. A configuration registers them under the prefix `projects` and turns them on by id:

```ts
import { PROJECTS_FAMILY } from '@hyperfrontend/workspace/lint'

export default [
  { families: { projects: PROJECTS_FAMILY } },
  { files: ['**/*.ts'], rules: { 'projects/module-boundaries': ['error', { depConstraints: [] }] } },
  { files: ['**/package.json'], rules: { 'projects/dependency-checks': 'error' } },
]
```

The entry also exports the readers the rules share with a workspace's own rules: the workspace root and project that own a file, its project file and manifest, the aliases of `tsconfig.base.json`, and the exports of a module. The rules are documented in [docs/rules/projects.md](./docs/rules/projects.md).

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
