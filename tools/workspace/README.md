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

`projects` lists every project with its type, root and tags; `graph` prints the node and edge counts, or with `--json` the projects, nodes and records; `explain` prints the groups a project draws and the groups drawn to it, one line per kind and role with the files behind it.

`sortEdges` puts edges in one canonical order, so a graph serialises to the same bytes whatever order their edges were found in. `selection.ts` holds the records the affected analysis produces: every decision carries a `Reason` whose `rule` is one of a closed set, so an explanation can always name the rule that fired.

## Affected baseline

`src/baseline/` captures what Nx itself selects for a revision range, as the evidence the owned analysis is compared against: the affected projects from `nx show projects --affected --json`, and the task-level selection with its reasons from `nx affected --explain=stdout`, both run without the daemon and with task selection on.

`scripts/replay-affected.ts` replays merged pull requests. For each of the newest merges on a branch it checks the merged branch's tip out in a worktree under `.hf/replay/worktrees/`, links the repository's `node_modules` into it, captures the selection from the merge base to the tip, and writes `.hf/replay/<merge sha>.json`. A merge already recorded is skipped, so an interrupted replay resumes. `lockfileSkew` in a record is true when the lock file at that revision differs from the one the shared `node_modules` was installed from; a comparison should weigh such a capture accordingly.

```bash
npx nx run tool-workspace:replay-affected
npx nx run tool-workspace:replay-affected --count=20 --targets=build,test
node --import ./tools/lint/src/runtime/aliases.ts \
  tools/workspace/scripts/replay-affected.ts --ref origin/main
```

The script loads workspace libraries from source through the lint tool's resolution hook, which is why the raw command passes `--import`; the Nx target does that for you. It runs Nx through `@hyperfrontend/integration-nx/adapters`, the package that holds every call into Nx. `.hf/` is ignored by git.

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
