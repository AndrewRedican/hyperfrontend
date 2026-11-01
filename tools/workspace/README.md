# @hyperfrontend/workspace

The workspace's own command line, dependency graph and pipeline, and the executors behind the root project's targets.

## Executors

### lint-report

Run lint across all projects and generate a compact, LLM-formatted report.

```bash
npm run hf -- run @hyperfrontend/workspace:lint:all
```

**Output:** `lint-output.txt` at workspace root (gitignored).

#### Options

| Option        | Type    | Default           | Description                                   |
| ------------- | ------- | ----------------- | --------------------------------------------- |
| `outputPath`  | string  | `lint-output.txt` | Output file path relative to workspace root   |
| `affected`    | boolean | `false`           | Only lint affected projects (vs all)          |
| `maxFixes`    | number  | `5`               | Number of files to suggest fixing first       |
| `failOnError` | boolean | `true`            | Exit with non-zero code when errors are found |

## Compatibility matrix

The root `LIBRARY_COMPATIBILITY.md` is derived from every publishable package's `project.json` and `package.json`. This package holds the one generator every writer of that document shares:

| Export                                  | Purpose                                                                                                   |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `collectMatrixLibraries(workspaceRoot)` | Reads the rows: one per publishable library under `libs/` and `plugins/`, sorted by package name.         |
| `renderCompatibilityDocument(rows)`     | Renders the document text from collected rows.                                                            |
| `buildCompatibilityDocument(root)`      | Both steps in one call; what the lint rule compares the committed file against.                           |
| `refreshCompatibilityDocument(root)`    | Writes the document when its content changed and returns its path, or `null` when it was already current. |

The `lib-compatibility-matrix` lint rule checks and fixes the committed file through `buildCompatibilityDocument`; the version flow in `@hyperfrontend/package` calls `refreshCompatibilityDocument` after every bump so the regenerated document travels in the version commit.

## Node.js floor probe

`scripts/probe-node-floor.mjs` loads every export entry of every built package under `dist/libs`, each in a child process of its own, both as `import` and as `require`, and fails when any of them cannot load. The packages declare `engines.node` while the toolchain runs on a far newer release, so this is the only check that notices an entry reading a global the floor does not have. It is plain JavaScript with no dependencies so it runs on the floor release itself; the `node-floor` CI job builds the packages on the toolchain Node.js, lists the distinct floors the manifests declare with `--list-floors`, and runs the probe once on each of those exact releases, so a package is checked on the floor it names rather than on the lowest one any package names.

```bash
npm run hf -- run-many -t build -p 'lib-*'
npx -y -p node@18.0.0 node tools/workspace/scripts/probe-node-floor.mjs
node tools/workspace/scripts/probe-node-floor.mjs --list-floors
```

One table at the top of the script carries the documented exceptions: entries that need a Node flag on some releases, passed the way the shipping code passes it. Keep it in step with the package READMEs. The probe checks that an entry loads, not that every export works: an API the floor lacks that is only read at call time still needs its own note in the package README.

A package whose own `engines.node` floor is above the running release is listed as skipped rather than probed. It never claimed to load there, so it is checked whenever the probe runs on a release it does cover; `@hyperfrontend/testing` declares Node.js 22.18 because it installs synchronous module hooks and loads TypeScript specs through Node's own type stripping.

## Railway deploy

`scripts/railway-deploy.mjs` deploys one commit to one Railway service and waits for the deployment to end. The pipeline runs it as the `deploy` task of a demo on `main`, after the demo's own tasks have passed, so each demo goes live on its own evidence rather than after every check suite of the commit. It runs the Railway CLI, fetched by npx at a pinned release, as `redeploy --service <service> --commit <sha>`: Railway builds that exact commit from the service's connected repository once, without pinning it, so a later push to `main` while the run is still going never slips into the build. The CLI's own push trigger is quiet in `.railway/railway.ts` (every service watches a path no commit touches, and Wait for CI is off), so the pipeline is the only thing that deploys. Plain JavaScript with no dependencies, like the probe.

```bash
HF_DEPLOY_SERVICE=clock RAILWAY_TOKEN=<project token> node tools/workspace/scripts/railway-deploy.mjs
HF_DEPLOY_SERVICE=clock HF_DEPLOY_COMMIT=<sha> HF_DEPLOY_TIMEOUT=45 node tools/workspace/scripts/railway-deploy.mjs
```

`HF_DEPLOY_SERVICE` is the service as the demo's `metadata.deploy.service` names it; `RAILWAY_TOKEN` is a project token of the production environment (the `RAILWAY_TOKEN` repository secret on CI); the commit defaults to `GITHUB_SHA`, then the checked-out head; the wait defaults to 30 minutes. The script reads the deployment's status every 15 seconds and exits non-zero when it ends as anything but `SUCCESS`, so the task's outcome means the demo is serving the commit.

## Railway provision

`scripts/railway-provision.mjs` applies `.railway/railway.ts` to the production environment when the two differ. The pipeline runs it as the `provision` task of the workspace on `main` whenever a deploy is planned or the push changed the file, after the workspace's lint and before every deploy, so each demo deploys with the settings the commit declares. It runs `config plan --detailed-exit-code --out <plan>`; when the plan shows changes it runs `config apply --plan <plan> --json`, which lands exactly the plan the log shows and fails if the environment moved since. It never passes `--confirm-destructive`, so a plan that deletes a service or a volume fails the task and the deploys behind it, and is applied by hand. The CLI is the release the deploy pins. The `railway` package that evaluates the file finds the CLI through `$_`, which the shell sets to whatever it ran last, so the script removes it from the CLI's environment.

```bash
RAILWAY_TOKEN=<project token> node tools/workspace/scripts/railway-provision.mjs
RAILWAY_TOKEN=<project token> HF_PROVISION_PLAN=/tmp/railway-plan.json node tools/workspace/scripts/railway-provision.mjs
```

`RAILWAY_TOKEN` is a project token of the production environment, as for the deploy; the plan is written to `.hf/pipeline/railway-plan.json` unless `HF_PROVISION_PLAN` names another file. The script prints `railway.ts is applied` when nothing differs and `applied railway.ts` after an apply, and exits non-zero on any other outcome.

## Binary budget

`scripts/check-binary-budget.mjs` stops a change from growing the repository with large files. Every committed byte stays in the history each clone downloads, and GitHub keeps it even after a history rewrite, so the check runs before a file lands rather than after. It walks every object the change adds on top of its base, across every commit rather than the net diff, so a file added and deleted again on the branch still counts. Anything reachable from the base costs nothing, so moving, renaming or restoring a file is free, and so is merging the base in.

| Limit                  | Applies to                                                                 | Over it                                        |
| ---------------------- | -------------------------------------------------------------------------- | ---------------------------------------------- |
| 2,000,000 bytes        | any single file, whatever its type                                         | always fails                                   |
| 2 MiB per pull request | images, video, audio, archives, documents, fonts and WebAssembly, added up | fails unless approved, and warns when approved |

It runs in three places:

- The `binary-budget` job in `ci-pr.yml` checks the pull request against its base and gates `status`. To approve a budget overrun, add the `binary-budget-approved` label to the pull request and re-run the failed jobs; the label is read when the job runs.
- The lefthook `pre-commit` hook checks the staged changes as the next commit. Only what that commit adds is held to the per-file limit, so later commits are not blocked by an oversized earlier one.
- The lefthook `pre-push` hook checks the checked-out branch against `origin/main`, the way CI does. Like the other pre-push commands, lefthook skips it when the push changes no files, and it checks the checked-out branch rather than each pushed ref; CI covers both.

Both hooks report a budget overrun as a warning, because approval is a decision for the pull request. Without an `origin/main` they warn and measure from `HEAD`, so a clone without it can still commit and push. Nothing overrides the per-file limit: a file that large belongs outside Git, for example as an absolute-URL video source on the docs site or a release asset. Raising a limit means editing the constant at the top of the script, in a reviewed commit.

```bash
node tools/workspace/scripts/check-binary-budget.mjs
node tools/workspace/scripts/check-binary-budget.mjs --staged
node tools/workspace/scripts/check-binary-budget.mjs --base <rev> --allow-over-budget
```

It is plain JavaScript with no dependencies, so the CI job runs it without installing the workspace. When `GITHUB_STEP_SUMMARY` is set it also appends the new binary files to the job summary.

## Pipeline

`src/pipeline/` plans and runs the continuous integration: what the pull-request and main workflows execute and what the pre-push hook executes locally. `bin/pipeline.ts` runs on the workspace Node.js with the alias hook, like the lint CLI.

```bash
node --import ./tools/lint/src/runtime/aliases.ts tools/workspace/bin/pipeline.ts plan --base origin/main --summary
node --import ./tools/lint/src/runtime/aliases.ts tools/workspace/bin/pipeline.ts run --environment linux
node --import ./tools/lint/src/runtime/aliases.ts tools/workspace/bin/pipeline.ts run --local
node --import ./tools/lint/src/runtime/aliases.ts tools/workspace/bin/pipeline.ts affected --target version --projects
```

`plan` asks the owned selection (`src/graph/affected`) which tasks of `typecheck`, `lint`, `test`, `build` and `e2e` a change reaches and writes `.hf/pipeline/plan.json`: a list of **chains**, one project on one environment, each holding its tasks, the prerequisites between them (`typecheck` before `build`; `build` before `e2e`, the floor probe, the consumer smoke, a `verify` and `publish`; every task's `dependsOn`), the reason each task is in and, in `skipped`, the rule that made every other task safe to leave out. An `e2e-<lib>` project's task joins the chain of the library it tests. Every planned task's `dependsOn` is planned too, transitively and as tasks of the same environment, one per id however many tasks need it (an application's `install` once for all its tasks, `demo-koi-lib:verify` before `demo-koi-pond:build`), each with a `pipeline-task` reason naming the tasks that need it. `dependsOn` is read in three forms, `target`, `^target` (that target of each project the project depends on) and `project:target`, and any other entry stops the plan with an error; an e2e task's `^build` means the build of the library it tests alone, since the e2e executor loads every other workspace package from source. The selection reads `dependsOn` through the same rule (`src/graph/depends-on.ts`). The Linux environment carries every chain; the Windows and macOS environments each carry the `typecheck`, `lint`, `test`, `build` and `e2e` of the libraries and tools, and the smokes of a library whose e2e project ships `scripts/consumer-smoke.mjs`. Chains are ranked heaviest first: libraries with a build by dependency depth, then the other libraries and tools, then the applications. `--all` plans every task of every project; `--fallback-all` does so when the base is not an ancestor of the head; `--main` adds `publish` after the builds of publishable libraries (in dependency order through `needs`) and `deploy` after the builds of the demos whose `metadata.deploy` names a Railway service, each after every other task of its chain, and `--catch-up` asks npm about every publishable library's current version and adds a whole chain for one the registry positively lacks; `--github-output` writes the `environments` matrix and `has-work`.

`run` executes one environment's chains with a scheduler: a task starts the moment every task it needs has succeeded and a slot is free (light tasks up to `--parallel`, the CPU count by default; library builds up to `--heavy`, two on CI and one under `--local` or below 12 GB of memory), the ready tasks are served by chain rank, the dependents of a failure are skipped with the prerequisite named, transitively and whatever order the tasks are listed in, a task whose runner throws or rejects ends as a failure, everything independent keeps running, and a running task is never aborted because another failed. Each task of a project is `bin/hf.ts run <project>:<target>` (below), which runs that task alone, started in its own process group so that stopping it ends every process it started (`taskkill /T` on Windows); the probe runs `scripts/probe-node-floor.mjs` on the package's declared floor through `npx -y -p node@<floor>`, the smoke runs the e2e project's script on the floor and on the newest release of its major, and the deploy runs `scripts/railway-deploy.mjs` with the service in `HF_DEPLOY_SERVICE` (below). Output is captured per task under `.hf/pipeline/logs/` and replayed as one block (`::group::` on GitHub) when the task ends. `--wait-for "<job name>[,<job name>]"` makes the publishes wait for each named sibling job of the same run whose environment the plan holds to conclude through the GitHub API (`actions: read`), skipping them with the reason when one fails or 120 minutes pass, the sibling jobs' own limit (a failed request to the jobs API counts as a job still running and is asked again until then; when the last one failed, the reason names its error); `--checks` creates one check run per chain (`<project> (<environment>)`, `checks: write`, best-effort), rewrites it as each of its tasks ends and completes it with the chain's conclusion, sending a chain's requests one at a time after its create, replacing a rewrite still waiting with a newer one and dropping it once the completion is queued, so the completion is always the last request; a chain whose tasks all end before any starts still gets its check run, opened as its first task ends; its `output.text` carries the chain's state as JSON (schema 1: the project, the environment, the task count and every ended task with its outcome, exit code, detail and times), which a page reads without a token. The ids of the check runs are kept in `.hf/pipeline/checks-<environment>.json` as they are created and completed. The results land in `.hf/pipeline/results-<environment>.json`, rewritten after every task that ends with `complete: false` and once more at the end with `complete: true`, so a job killed by its time limit still leaves the tasks that had ended; the summary (totals, task table, Mermaid timeline) on standard output and, with `--summary`, in the job summary. The exit code is zero only when every task succeeded. `--local` plans from the merge base with `origin/main` to the working tree and runs one task at a time: the pre-push hook.

`plan --checks` also publishes the plan as a `pipeline plan` check run on the head commit, created complete in one request so that a cancelled job never leaves it in progress: its summary is the plan summary and its `output.text` the compact plan as JSON (schema 1: the range, the mode, whether it publishes, the environments, every chain with its tasks, their targets, weights and needs, and the count of skipped tasks; the needs are dropped and `truncated` set when the text would pass GitHub's 65,535 characters).

`finalize [--environment <env>]` runs after `run` whatever happened (`if: always()`): when the results file says the run did not end, it summarises the tasks that had ended, and it completes as `cancelled` every check run the run created and never completed, naming how many of the chain's tasks had ended.

`record --out <dir> --run-id <id> --run-number <n> --sha <sha> [--attempt <n>] [--ref <ref>] [--event <event>] [--url <url>]` writes the record of a run into a checkout of the `ci-records` branch: `runs/<run id>.json` (schema 1: the run's identity, the plan and each environment's results), `index.json` (the newest 500 runs first, each with its mode, chain and task counts and an outcome of `success`, `failure`, `cancelled` or `incomplete`) and `graph/latest.json`, the explorer document: the persisted `graph.json` folded into one link per project, target node, edge kind and role, with every file and line behind it, and the projects, entries, packages, tools and configuration files the links reach. The `records` job of the main workflow pushes that branch; the docs-site's dependency and pipeline explorers read it from `raw.githubusercontent.com`.

`affected --target <t>` prints the tasks (or `--projects`, the projects; `--json`, the whole affected set) the owned selection picks for one target, and nothing else on standard output: the graph-state line goes to standard error. The `version-check` action reads `affected --target version-check --projects`.

## Command line

`bin/hf.ts` is the workspace's task entry, behind the root script `npm run hf -- <command>`. It runs every task the way the pipeline does: no cache, nothing restored.

```bash
npm run hf -- run lib-logging:test
npm run hf -- run lib-logging:publish --dryRun
npm run hf -- run-many -t build -p docs-site
npm run hf -- run-many -t test,typecheck -p 'lib-*,tool-*'
npm run hf -- affected -t test --base=origin/main
npm run hf -- format --check
npm run hf -- format --write --files=README.md,CONTRIBUTING.md
npm run hf -- generate library --name=my-utils --type=util --dry-run
npm run hf -- show projects --with-target=publish
npm run hf -- graph explain lib-logging
```

| Command                                               | What it does                                                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `run <project>:<target> [--name=value ...]`           | Runs that one task alone, without the tasks it depends on                                                  |
| `run-many -t <targets> (-p <names> \| --all)`         | Runs the tasks and their `dependsOn` prerequisites in order, skipping the dependents of a failure          |
| `affected -t <targets> [--base=<ref>] [--head=<ref>]` | Runs the tasks the owned selection picks for the change, from the merge base with `origin/main` by default |
| `format --check\|--write [--all \| --files=<list>]`   | Runs prettier on the changed files, every file, or the files named                                         |
| `generate <generator> [--option=value ...]`           | Runs a `@hyperfrontend/package` generator: `library`, `make-publishable`, `rename`, `move`                 |
| `show projects [--with-target=<target>] [--json]`     | Lists the project names                                                                                    |
| `graph <command>`                                     | The graph commands of `bin/graph.ts`, described under [Workspace graph](#workspace-graph)                  |

The root project's targets are named through its project name, `@hyperfrontend/workspace:lint:all`. `-p` takes names and `*` globs, comma-separated.

`run` finds the workspace root from any directory below it, merges the target of the project's `project.json` with `nx.json`'s `targetDefaults`, and runs exactly that task: nothing the task depends on runs first, and nothing is cached or restored. An `nx:run-commands` target runs its commands through the platform shell, with `node_modules/.bin` on the path. Any other target names one of the workspace's own executors (`@hyperfrontend/package`, `@hyperfrontend/app` or `@hyperfrontend/workspace`), which is loaded from the `executors.json` its package declares and called in the same process, with the defaults of its schema and an executor context built from the discovered projects. `--name=value` after the task sets an option, read as the type the executor's schema declares, and `--name` alone sets it to `true`; after a run-commands target the arguments reach the command. Configurations, the other executors of the `nx` package and executors of installed packages are refused. Its own messages go to standard error; it exits 0 when the task succeeded and 1 otherwise.

## Workspace graph

`src/graph/`, exported as `@hyperfrontend/workspace/graph`, builds the owned dependency graph: what the workspace is made of and how its parts depend on one another, qualified more finely than a project-level graph can be. `workspaceGraph(root)` builds it once per process from the files git tracks or would track (less `.nxignore`), the `project.json` and `package.json` files among them, `tsconfig.base.json`, `nx.json` and `package-lock.json`. Nothing under the directory imports Nx; a spec reads every import under it and fails on `nx`, `@nx/*` or the Nx-facing adapters. The lint rules of the `projects` family read the graph, and the `version-batch` executor maps changed files to versionable projects through it.

| Node kind  | Identity                                     | Read from                                                    |
| ---------- | -------------------------------------------- | ------------------------------------------------------------ |
| `project`  | the Nx project name                          | `project.json`, or a lone `package.json`                     |
| `file`     | workspace-relative POSIX path, with its role | `git ls-files`                                               |
| `entry`    | `<package>` or `<package>/<subpath>`         | `package.json#exports`, cross-checked with the aliases       |
| `external` | `<name>@<version>`                           | `package-lock.json`                                          |
| `tool`     | the executor a target runs                   | `project.json` targets, `nx.json` defaults, `executors.json` |
| `config`   | a configuration file or glob a target reads  | target inputs after the named inputs expand                  |
| `task`     | `<project>:<target>`                         | targets after the defaults merge                             |

The graph carries two views of the same imports. `edges` holds the project edges as Nx draws them (`static`, `dynamic`, `implicit`). `records` holds every qualified edge in canonical order: from a file to the file, entry or installed package it imports, or from a project to the projects it declares, the packages its manifest depends on, the tools its targets run and the configuration its inputs name. Each record carries its `kind` (`value`, `type`, `side-effect`, `re-export-all`, `dynamic`, `unresolved`, `manifest`, `declared`, `tool`, `config`), the `role` of the file that drew it, the specifier and what it resolved to, the targets it is relevant to, and its evidence: a source position or a configuration key. `groups` collects the records between a project and each node outside it by kind and role, so an import from a spec is visible as such rather than collapsed into one project dependency.

The role comes from `roles.ts`: `production`, `spec`, `test-config`, `lint-config`, `build-config`, `script`, `docs` or `asset`, derived from the exclusions of the `production` named input in `nx.json` plus fixed patterns (`__test-utils__/`, `scripts/`, configuration basenames). The module lists the exclusions it implements, and a spec compares that list with `nx.json`, so an exclusion added there without a matching rule here fails the suite instead of being treated as production.

Imports are read with the linter's parser under Nx's rules, so a `require` inside a function or an `import()` counts as dynamic exactly when Nx counts it so, and each import records its form, whether it brings in types alone, the names it imports and its position. They are remembered in `node_modules/.cache/hyperfrontend-lint/imports.json`: a file whose size and modification time are unchanged is not read again, and one whose content hash is unchanged is not parsed again. The cache names the reader that wrote it, a hash of the parser's sources where the workspace aliases the parser package to its source, so a parser change invalidates it.

```bash
npm run hf -- graph projects
npm run hf -- graph graph --json
npm run hf -- graph explain lib-logging
node --import ./tools/lint/src/runtime/aliases.ts tools/workspace/bin/graph.ts explain lib-logging
```

`projects` lists every project with its type, root and tags; `graph` prints the node and edge counts, or with `--json` the projects, nodes and records; `explain <project>` prints the groups a project draws and the groups drawn to it, one line per kind and role with the files behind it; `explain <project:target>`, `build`, `verify`, `status` and `affected` are described below.

`sortEdges` puts edges in one canonical order, so a graph serialises to the same bytes whatever order their edges were found in. `selection.ts` holds the records the affected analysis produces: every decision carries a `Reason` whose `rule` is one of a closed set, so an explanation can always name the rule that fired.

A load whose specifier is an expression (`import(name)`, `require(path)`, `createRequire(...)(x)`) is kept as an `unresolved` import whose text is the expression, and a file the parser cannot read draws one `unresolved` edge to its own project with no specifier at all. Both make the analysis below treat the project as reachable whole, which is the conservative answer when the graph cannot say what a file reaches.

### Persisted state

`src/graph/store/` keeps the graph under `.hf/graph/` (ignored by git and prettier) as five files, each an envelope of `{ body, digest, schema }` in canonical JSON: `files.json` (every file with the blob id git computes for it, so a checkout's line-ending filters apply as they apply to the index), `imports.json` (the imports of each code file keyed by that hash, `null` for a file that does not parse), `graph.json` (projects, nodes, records and the Nx project edges), `entries.json` (the files each entry can reach and a digest of their content) and `meta.json` (the schema, a hash of the graph sources, the import reader, the Node major and the hash of each global configuration file). `buildState` runs under a lock file holding the writer's pid, stale once the pid is dead or after a minute, reads what is persisted, reparses only the code files whose hash changed, rebuilds the graph in memory and rewrites only the files whose bytes differ, so two consecutive builds leave every modification time alone. A change to `nx.json`, the root `package.json`, the lock file or `tsconfig.base.json`, or to the graph sources or the parser, rebuilds cold; a corrupted or foreign file reads as absent and rebuilds cold as well. Two checkouts of the same commit write byte-identical files, on Linux and Windows alike, and the state directory never lists itself.

```bash
npm run hf -- graph build
npm run hf -- graph build --force
npm run hf -- graph verify
npm run hf -- graph status --json
```

`build` updates the state incrementally and `--force` builds it cold; `verify` compares a cold rebuild byte for byte and exits 1 on drift; `status` prints what is persisted and what a build would do.

The `plan` job of both pipeline workflows builds the state cold, since nothing is cached between runs, and uploads `graph.json` beside the plan; the Windows and macOS legs build the state cold as well and fail if their `graph.json` digest differs from the Linux one.

### Affected analysis

`src/graph/affected/` decides, for every task of a target, whether a change set selects it, and writes the reason either way. `changes.ts` reads the change set from git: from the merge base of two revisions to the head, or to the working tree with its dirty and untracked files, renames detected. A task is selected by a changed file among its own inputs, by a changed file of another project its closure reaches, by a changed implementation of a tool it runs, by a changed manifest or a deleted or added configuration of a project it depends on, by a global configuration file, or because a task it runs after (`dependsOn`) is selected. The closure of a task starts from its own files and follows the file edges of the kinds the target cares about through entries into other projects; what the graph cannot follow precisely it counts whole, and says so: a project whose reachable file loads a module it cannot name, a project whose production file does not parse, the owner of a dangling import (reported as a deleted or renamed module when the change set deleted or renamed the target), a project re-exported whole with `export *`, every member of a cross-project cycle, every implicit dependency of a project entered, and the targets of the side-effect imports of any project entered, whichever entry was consumed.

Two rules go beyond what the inputs in `nx.json` say. A `type`-only import does not reach `test` or `lint`, which strip types before running. And `build` reaches its dependencies from its production files alone, since its artifact derives from nothing else; every other target reaches them from every own file it reads, so a spec importing `@hyperfrontend/testing` carries the dependency into `test` and `typecheck` but not into `build`. Both are the first rules to revisit if a CI run shows a task skipped that should have run.

Every skipped task carries a reason as well: `unreachable` (naming the kinds and roles through which the task's project depends on the changed one, when it does), `kind-irrelevant` (reachable only through type-only imports), or `role-irrelevant` (a spec or configuration file the target's inputs leave out). The fallbacks that fired are listed once each. A `dependsOn` on another target decides that target as well, and the selection of a target runs to a fixed point so a dependency on the same target is honoured.

```bash
npm run hf -- graph affected --target build --base main
npm run hf -- graph affected --target build --base main --explain
npm run hf -- graph affected --target test \
  --base origin/main --head HEAD --json
npm run hf -- graph explain lib-logging:build --base main
```

The first form prints the selected task ids alone; `--explain` adds every reason, the skipped tasks and the fallbacks; `--json` prints the affected set itself.

The graph is built from the working tree whatever `--head` names, so the analysis of a historical range is exact only when the working tree is that head. Handing the analysis the graph at the base as well (`selectAffected({ previous })`) lets a deleted or renamed module name the tasks it reached before the change even where no import dangles; the command line does not do that yet.

### Artifact drift

`scripts/artifact-drift.ts` reports whether the packages the workspace would publish now differ from what the registry holds at the same version: it rebuilds the named projects (or every project with a `publish` target), packs each `dist` with `npm pack --dry-run --json`, hashes the listed files, retrieves the published tarball with `npm pack <name>@<version> --ignore-scripts`, reads it with the tar reader in `src/artifact-drift/` (no system `tar`), and prints the files added, removed and changed with a content hash of each side. It reports and exits zero; nothing acts on it.

```bash
node --import ./tools/lint/src/runtime/aliases.ts \
  tools/workspace/scripts/artifact-drift.ts --projects lib-logging,lib-nexus
node --import ./tools/lint/src/runtime/aliases.ts \
  tools/workspace/scripts/artifact-drift.ts --skip-build
```

## Upstream type extraction

`src/types-extract/` generates the `@nx/devkit`-compatible declarations the workspace compiles against instead of the devkit's own types: `libs/integrations/nx/src/compat/`. It reads Nx's TypeScript sources from GitHub at the tag `types-extract.config.ts` names, resolved once to a commit through the GitHub API and pinned in `types-extract.lock.json`, so every later run and every check reads the same bytes until the lock is deliberately updated. Nothing is installed or executed; files are fetched with `fetch` and parsed with the `typescript` package, syntactically, with no program or checker.

The configuration lists requests: a root module, the exported names wanted, how many references deep to follow, and the output file. The walk starts at the roots, follows every type reference through imports, re-exports and star exports within the followed directories, and places each declaration it reaches in the output of the first request that reached it, a root always in its own request's output. What it cannot or will not carry is written as `unknown`, or as the type the configuration's `boundary.overrides` names for a declaration, and every such rewrite is a row of the generated `REPORT.md`: a reference past the depth, a declaration from a package or outside the followed directories, a `typeof` of a runtime value, an `any` (written as `unknown`), a parameter left untyped (annotated), an enum (carried as the union of its values), a class (carried as the interface of its public instance members), a namespace member (carried flattened under `<Namespace>_<Name>`). Node built-in types stay imports; globals such as `Record` stay as written. The generated `NOTICE.md` lists the upstream files read and reproduces the upstream license.

```bash
npm run hf -- run tool-workspace:types-extract
npm run hf -- run tool-workspace:types-extract-check
node --import ./tools/lint/src/runtime/aliases.ts tools/workspace/bin/types-extract.ts --update
```

The first command regenerates the files and the lock, writing only what changed. The check regenerates in memory and fails on any byte that differs from the disk, or when the lock does not pin every source as configured; run it twice to see that the output is deterministic. `--update` re-resolves every ref, which is how a branch ref is moved; a tag never moves, so changing the Nx version is editing `ref` in the configuration and running the first command. `GITHUB_TOKEN`, when set, authenticates the API call that resolves the ref.

## Future Executors

- `typecheck-report`: Type error report
- `test-report`: Test failure report
