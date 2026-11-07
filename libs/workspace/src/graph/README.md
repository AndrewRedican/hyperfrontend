# graph

The owned workspace graph: what a workspace is made of and how its parts reach one another, qualified more finely than a project-level graph can be, so that a change can be traced to exactly the tasks it affects.

[`workspaceGraph`](https://www.hyperfrontend.dev/docs/libraries/workspace/graph/#api-workspaceGraph) builds it once per process from the files git tracks or would track (less `.hfignore`), the `project.json` and `package.json` files among them, `tsconfig.base.json`, `hf.json` and `package-lock.json`.

| Node kind | Identity                                     | Read from                                                    |
| --------- | -------------------------------------------- | ------------------------------------------------------------ |
| project   | the project name                             | `project.json`, or a lone `package.json`                     |
| file      | workspace-relative POSIX path, with its role | `git ls-files`                                               |
| entry     | `<package>` or `<package>/<subpath>`         | the manifest's exports, cross-checked with the aliases       |
| external  | `<name>@<version>`                           | `package-lock.json`                                          |
| tool      | the executor a target runs                   | `project.json` targets, `hf.json` defaults, `executors.json` |
| config    | a configuration file or glob a target reads  | target inputs after the named inputs expand                  |
| task      | `<project>:<target>`                         | targets after the defaults merge                             |

## Two views of the same imports

The graph keeps the project edges a project-level tool would draw (static, dynamic, implicit) and, beside them, every qualified edge in one canonical order: from a file to the file, entry or installed package it imports, or from a project to the projects it declares, the packages its manifest depends on, the tools its targets run and the configuration its inputs name.

Each record carries its kind (value, type, side effect, re-export, dynamic, unresolved, manifest, declared, tool, config), the role of the file that drew it, what it resolved to and its evidence. The records between a project and each node outside it are grouped by kind and role, so an import from a spec is visible as such rather than collapsed into one project dependency.

A file's role (production, spec, test config, lint config, build config, script, docs, asset) derives from the exclusions of the production [named input](https://www.hyperfrontend.dev/docs/libraries/workspace/graph/#api-Role) in `hf.json` plus fixed patterns. Imports are parsed once and remembered under `node_modules/.cache/`: a file whose size and modification time are unchanged is not read again, and one whose content hash is unchanged is not parsed again.

## Affected analysis

[`selectAffected`](https://www.hyperfrontend.dev/docs/libraries/workspace/graph/#api-selectAffected) decides, for every task of a target, whether a change set selects it, and writes the reason either way. A task is selected by a changed file among its own inputs, by a changed file of another project its closure reaches, by a changed implementation of a tool it runs, by a changed manifest or configuration of a project it depends on, by a global configuration file, or because a task it runs after is selected. What the graph cannot follow precisely it counts whole, and says so: a dynamic load it cannot name, a file that does not parse, a dangling import, a project re-exported whole, every member of a cross-project cycle, every implicit dependency.

Two rules go beyond what the inputs say. A type-only import does not reach test or lint, which strip types before running. And build reaches its dependencies from production files alone, since its artifact derives from nothing else; every other target reaches them from every file it reads.

```bash
npx hf graph explain lib-logging
npx hf graph explain lib-logging:build --base main
npx hf graph affected --target test --base origin/main --explain
```

## Persisted state

[`buildState`](https://www.hyperfrontend.dev/docs/libraries/workspace/graph/#api-buildState) keeps the graph under `.hf/graph/` as canonical JSON envelopes: the files with the blob id git computes for each, the imports keyed by that hash, the graph, the files each entry can reach, and the metadata that decides whether a rebuild is cold. A build reparses only the files whose content changed and rewrites only the state files whose bytes differ; two checkouts of the same commit hold the same state, which the verify command checks in CI.

```bash
npx hf graph build
npx hf graph verify
npx hf graph status --json
```
