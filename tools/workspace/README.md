# @hyperfrontend/workspace

Nx plugin providing workspace-wide executors for LLM-optimized reports.

## Executors

### lint-report

Run lint across all projects and generate a compact, LLM-formatted report.

```bash
npx nx run @hyperfrontend/workspace:lint:all
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
npx nx run-many -t build --projects=tag:scope:public
npx -y -p node@18.0.0 node tools/workspace/scripts/probe-node-floor.mjs
node tools/workspace/scripts/probe-node-floor.mjs --list-floors
```

One table at the top of the script carries the documented exceptions: entries that need a Node flag on some releases, passed the way the shipping code passes it. Keep it in step with the package READMEs. The probe checks that an entry loads, not that every export works: an API the floor lacks that is only read at call time still needs its own note in the package README.

A package whose own `engines.node` floor is above the running release is listed as skipped rather than probed. It never claimed to load there, so it is checked whenever the probe runs on a release it does cover; `@hyperfrontend/testing` declares Node.js 22.18 because it installs synchronous module hooks and loads TypeScript specs through Node's own type stripping.

## Binary budget

`scripts/check-binary-budget.mjs` stops a change from growing the repository with large files. Every committed byte stays in the history each clone downloads, and GitHub keeps it even after a history rewrite, so the check runs before a file lands rather than after. It walks every object the change adds on top of its base, across every commit rather than the net diff, so a file added and deleted again on the branch still counts. Anything reachable from the base costs nothing, so moving, renaming or restoring a file is free, and so is merging the base in.

| Limit                  | Applies to                                                                 | Over it                                        |
| ---------------------- | -------------------------------------------------------------------------- | ---------------------------------------------- |
| 2,000,000 bytes        | any single file, whatever its type                                         | always fails                                   |
| 6 MiB per pull request | images, video, audio, archives, documents, fonts and WebAssembly, added up | fails unless approved, and warns when approved |

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

The graph carries two views of the same imports. `edges` holds the project edges as Nx draws them (`static`, `dynamic`, `implicit`), which the `graph-oracle` script under `tools/lint/scripts/` compares with the file `nx graph --file` writes. `records` holds every qualified edge in canonical order: from a file to the file, entry or installed package it imports, or from a project to the projects it declares, the packages its manifest depends on, the tools its targets run and the configuration its inputs name. Each record carries its `kind` (`value`, `type`, `side-effect`, `re-export-all`, `dynamic`, `unresolved`, `manifest`, `declared`, `tool`, `config`), the `role` of the file that drew it, the specifier and what it resolved to, the targets it is relevant to, and its evidence: a source position or a configuration key. `groups` collects the records between a project and each node outside it by kind and role, so an import from a spec is visible as such rather than collapsed into one project dependency.

The role comes from `roles.ts`: `production`, `spec`, `test-config`, `lint-config`, `build-config`, `script`, `docs` or `asset`, derived from the exclusions of the `production` named input in `nx.json` plus fixed patterns (`__test-utils__/`, `scripts/`, configuration basenames). The module lists the exclusions it implements, and a spec compares that list with `nx.json`, so an exclusion added there without a matching rule here fails the suite instead of being treated as production.

Imports are read with the linter's parser under Nx's rules, so a `require` inside a function or an `import()` counts as dynamic exactly when Nx counts it so, and each import records its form, whether it brings in types alone, the names it imports and its position. They are remembered in `node_modules/.cache/hyperfrontend-lint/imports.json`: a file whose size and modification time are unchanged is not read again, and one whose content hash is unchanged is not parsed again. The cache names the reader that wrote it, a hash of the parser's sources where the workspace aliases the parser package to its source, so a parser change invalidates it.

```bash
npx nx run tool-workspace:graph -- projects
npx nx run tool-workspace:graph -- graph --json
npx nx run tool-workspace:graph -- explain lib-logging
node --import ./tools/lint/src/runtime/aliases.ts tools/workspace/bin/graph.ts explain lib-logging
```

`projects` lists every project with its type, root and tags; `graph` prints the node and edge counts, or with `--json` the projects, nodes and records; `explain <project>` prints the groups a project draws and the groups drawn to it, one line per kind and role with the files behind it; `explain <project:target>`, `build`, `verify`, `status` and `affected` are described below.

`sortEdges` puts edges in one canonical order, so a graph serialises to the same bytes whatever order their edges were found in. `selection.ts` holds the records the affected analysis produces: every decision carries a `Reason` whose `rule` is one of a closed set, so an explanation can always name the rule that fired.

A load whose specifier is an expression (`import(name)`, `require(path)`, `createRequire(...)(x)`) is kept as an `unresolved` import whose text is the expression, and a file the parser cannot read draws one `unresolved` edge to its own project with no specifier at all. Both make the analysis below treat the project as reachable whole, which is the conservative answer when the graph cannot say what a file reaches.

### Persisted state

`src/graph/store/` keeps the graph under `.hf/graph/` (ignored by git and prettier) as five files, each an envelope of `{ body, digest, schema }` in canonical JSON: `files.json` (every file with the blob id git computes for it, so a checkout's line-ending filters apply as they apply to the index), `imports.json` (the imports of each code file keyed by that hash, `null` for a file that does not parse), `graph.json` (projects, nodes, records and the Nx project edges), `entries.json` (the files each entry can reach and a digest of their content) and `meta.json` (the schema, a hash of the graph sources, the import reader, the Node major and the hash of each global configuration file). `buildState` runs under a lock file holding the writer's pid, stale once the pid is dead or after a minute, reads what is persisted, reparses only the code files whose hash changed, rebuilds the graph in memory and rewrites only the files whose bytes differ, so two consecutive builds leave every modification time alone. A change to `nx.json`, the root `package.json`, the lock file or `tsconfig.base.json`, or to the graph sources or the parser, rebuilds cold; a corrupted or foreign file reads as absent and rebuilds cold as well. Two checkouts of the same commit write byte-identical files, on Linux and Windows alike, and the state directory never lists itself.

```bash
npx nx run tool-workspace:graph -- build
npx nx run tool-workspace:graph -- build --force
npx nx run tool-workspace:graph -- verify
npx nx run tool-workspace:graph -- status --json
```

`build` updates the state incrementally and `--force` builds it cold; `verify` compares a cold rebuild byte for byte and exits 1 on drift; `status` prints what is persisted and what a build would do.

The `setup` job of the pull-request workflow restores `.hf/graph` from the actions cache keyed by the lock file, builds incrementally, runs `verify`, and on drift warns and rebuilds cold without failing; the Windows leg builds the state cold and fails if its `graph.json` digest differs from the Linux one.

### Affected analysis

`src/graph/affected/` decides, for every task of a target, whether a change set selects it, and writes the reason either way. `changes.ts` reads the change set from git: from the merge base of two revisions to the head, or to the working tree with its dirty and untracked files, renames detected. A task is selected by a changed file among its own inputs, by a changed file of another project its closure reaches, by a changed implementation of a tool it runs, by a changed manifest or a deleted or added configuration of a project it depends on, by a global configuration file, or because a task it runs after (`dependsOn`) is selected. The closure of a task starts from its own files and follows the file edges of the kinds the target cares about through entries into other projects; what the graph cannot follow precisely it counts whole, and says so: a project whose reachable file loads a module it cannot name, a project whose production file does not parse, the owner of a dangling import (reported as a deleted or renamed module when the change set deleted or renamed the target), a project re-exported whole with `export *`, every member of a cross-project cycle, every implicit dependency of a project entered, and the targets of the side-effect imports of any project entered, whichever entry was consumed.

Two rules go beyond what the inputs in `nx.json` say. A `type`-only import does not reach `test` or `lint`, which strip types before running. And `build` reaches its dependencies from its production files alone, since its artifact derives from nothing else; every other target reaches them from every own file it reads, so a spec importing `@hyperfrontend/testing` carries the dependency into `test` and `typecheck` but not into `build`. Both are the first rules to revisit if the comparison against Nx shows a task skipped that should have run.

Every skipped task carries a reason as well: `unreachable` (naming the kinds and roles through which the task's project depends on the changed one, when it does), `kind-irrelevant` (reachable only through type-only imports), or `role-irrelevant` (a spec or configuration file the target's inputs leave out). The fallbacks that fired are listed once each. A `dependsOn` on another target decides that target as well, and the selection of a target runs to a fixed point so a dependency on the same target is honoured.

```bash
npx nx run tool-workspace:graph -- affected --target build --base main
npx nx run tool-workspace:graph -- affected --target build --base main --explain
npx nx run tool-workspace:graph -- affected --target test \
  --base origin/main --head HEAD --json
npx nx run tool-workspace:graph -- explain lib-logging:build --base main
```

The first form prints the selected task ids alone; `--explain` adds every reason, the skipped tasks and the fallbacks; `--json` prints the affected set itself.

The graph is built from the working tree whatever `--head` names, so the analysis of a historical range is exact only when the working tree is that head; the comparison harness checks each revision out before it asks. Handing the analysis the graph at the base as well (`selectAffected({ previous })`) lets a deleted or renamed module name the tasks it reached before the change even where no import dangles; the command line does not do that yet.

### Artifact drift

`scripts/artifact-drift.ts` reports whether the packages the workspace would publish now differ from what the registry holds at the same version: it rebuilds the named projects (or every project with a `publish` target), packs each `dist` with `npm pack --dry-run --json`, hashes the listed files, retrieves the published tarball with `npm pack <name>@<version> --ignore-scripts`, reads it with the tar reader in `src/artifact-drift/` (no system `tar`), and prints the files added, removed and changed with a content hash of each side. It reports and exits zero; nothing acts on it.

```bash
node --import ./tools/lint/src/runtime/aliases.ts \
  tools/workspace/scripts/artifact-drift.ts --projects lib-logging,lib-nexus
node --import ./tools/lint/src/runtime/aliases.ts \
  tools/workspace/scripts/artifact-drift.ts --skip-build
```

## Affected baseline

`src/baseline/` captures what Nx itself selects for a revision range, as the evidence the owned analysis is compared against: the affected projects from `nx show projects --affected --json`, and the task-level selection with its reasons from `nx affected --explain=stdout`, both run without the daemon and with task selection on.

`scripts/replay-affected.ts` replays history. For each of the newest merges on a branch, or with `--commits` for each of its newest commits against their parents, it checks the head out in a worktree under `.hf/replay/worktrees/`, links the repository's `node_modules` into it, captures the selection from the base to the head, and writes `.hf/replay/<sha>.json` with the range's `kind`. A range already recorded is skipped, so an interrupted replay resumes. A revision whose `nx.json` names a plugin the shared `node_modules` no longer holds cannot run Nx; it is reported as not replayable and left unrecorded, so the replay reaches back only as far as the installed plugins allow. `lockfileSkew` in a record is true when the lock file at that revision differs from the one the shared `node_modules` was installed from; a comparison should weigh such a capture accordingly.

```bash
npx nx run tool-workspace:replay-affected
npx nx run tool-workspace:replay-affected --count=20 --targets=build,test
npx nx run tool-workspace:replay-affected --commits --count=40
node --import ./tools/lint/src/runtime/aliases.ts \
  tools/workspace/scripts/replay-affected.ts --ref origin/main
```

The script loads workspace libraries from source through the lint tool's resolution hook, which is why the raw command passes `--import`; the Nx target does that for you. It runs Nx through `@hyperfrontend/integration-nx/adapters`, the package that holds every call into Nx. `.hf/` is ignored by git.

### Comparison with Nx

`scripts/compare-affected.ts` decides every task of every captured target twice, by Nx and by the owned analysis, and classifies each difference. Without a range it reads the replay captures, checks each head out in a worktree (and its base in another, so a deleted or renamed module can name the tasks it reached), builds the owned graph there, runs the analysis over the same change set and compares. With `--base` it captures Nx's selection for the range now, in the working tree, and compares that; the `graph-advisory` job of the pull-request workflow does this for every pull request, and the weekly `graph-advisory` workflow replays and compares `main`. The classifier and the renderer live in `src/compare/`.

| Verdict                | Meaning                                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `agree`                | Both selected the task.                                                                                                                        |
| `both-skipped`         | Neither selected it.                                                                                                                           |
| `narrower-explained`   | Category (a): Nx selected it, the owned analysis skipped it, and a skip reason of the closed rule set answers every file Nx cites.             |
| `wider`                | Category (b): the owned analysis selected it and Nx did not. Documented when it rests on `dependent-task`, `global-config` and `tool-changed`. |
| `narrower-unexplained` | Category (c): Nx selected it, the owned analysis skipped it, and at least one Nx reason has no answer. The acceptance of the analysis is zero. |
| `nx-only`              | Nx selected a task the owned graph has no task for: the `lint` tasks the lint plugin infers.                                                   |

The three documented wider rules are deliberate: a task selected because a task it runs after is selected, which Nx does not do; a change to `nx.json`, the root `package.json`, the lock file or `tsconfig.base.json`, which the owned analysis treats as invalidating every task while Nx weighs what changed in them; and a change to the source of the executor a task runs, which Nx does not read, so a change to `tools/package` selects every task running one of its executors.

The defaults in `nx.json#targetDefaults` apply to a target only when Nx would merge them: the two name the same executor or one names none, and a `run-commands` or `run-script` pair runs the same command or script or one names none. The demos' builds run `@hyperfrontend/app:build`, so the `build` defaults, their `projects` input among them, leave them alone; the comparison is what showed the owned graph applying them anyway.

```bash
npx nx run tool-workspace:compare-affected
npx nx run tool-workspace:compare-affected -- --count 10 --rebuild 10
npx nx run tool-workspace:compare-affected -- \
  --base origin/main --head HEAD --label "my branch"
node --import ./tools/lint/src/runtime/aliases.ts \
  tools/workspace/scripts/compare-affected.ts --strict
```

The report is written to `.hf/replay/report.md` (`--out`) and, with `--summary`, appended to the GitHub job summary. `--rebuild <n>` takes up to `n` of the build tasks the owned analysis would have skipped, spread across the ranges, builds each at the base and the head of its range with the Nx cache bypassed and records whether every file under the project's `dist` directory is byte-identical; only tasks running `@hyperfrontend/package:build` are rebuilt. `--skip-previous` leaves the base graph out. The exit code is zero unless `--strict` is given and a category (c) task is found.

## Upstream type extraction

`src/types-extract/` generates the `@nx/devkit`-compatible declarations the workspace compiles against instead of the devkit's own types: `libs/integrations/nx/src/compat/`. It reads Nx's TypeScript sources from GitHub at the tag `types-extract.config.ts` names, resolved once to a commit through the GitHub API and pinned in `types-extract.lock.json`, so every later run and every check reads the same bytes until the lock is deliberately updated. Nothing is installed or executed; files are fetched with `fetch` and parsed with the `typescript` package, syntactically, with no program or checker.

The configuration lists requests: a root module, the exported names wanted, how many references deep to follow, and the output file. The walk starts at the roots, follows every type reference through imports, re-exports and star exports within the followed directories, and places each declaration it reaches in the output of the first request that reached it, a root always in its own request's output. What it cannot or will not carry is written as `unknown`, or as the type the configuration's `boundary.overrides` names for a declaration, and every such rewrite is a row of the generated `REPORT.md`: a reference past the depth, a declaration from a package or outside the followed directories, a `typeof` of a runtime value, an `any` (written as `unknown`), a parameter left untyped (annotated), an enum (carried as the union of its values), a class (carried as the interface of its public instance members), a namespace member (carried flattened under `<Namespace>_<Name>`). Node built-in types stay imports; globals such as `Record` stay as written. The generated `NOTICE.md` lists the upstream files read and reproduces the upstream license.

```bash
npx nx run tool-workspace:types-extract
npx nx run tool-workspace:types-extract-check
node --import ./tools/lint/src/runtime/aliases.ts tools/workspace/bin/types-extract.ts --update
```

The first command regenerates the files and the lock, writing only what changed. The check regenerates in memory and fails on any byte that differs from the disk, or when the lock does not pin every source as configured; run it twice to see that the output is deterministic. `--update` re-resolves every ref, which is how a branch ref is moved; a tag never moves, so changing the Nx version is editing `ref` in the configuration and running the first command. `GITHUB_TOKEN`, when set, authenticates the API call that resolves the ref.

## Future Executors

- `typecheck-report` — Type error report
- `test-report` — Test failure report
